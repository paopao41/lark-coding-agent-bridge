import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, basename, extname } from 'node:path';

import { log } from '../core/logger';
import type { KnowledgeDocument } from './types';

/**
 * UTF-8 BOM byte sequence (0xEF 0xBB 0xBF), encoded here as the literal
 * string "\uFEFF" — `readFile(..., 'utf8')` decodes the BOM to U+FEFF.
 * Stripping it lets downstream XML/markdown parsers see the actual content
 * without a leading zero-width character that some tools reject.
 */
const UTF8_BOM = '\uFEFF';

/** Frontmatter delimiter line. */
const FRONTMATTER_DELIM = '---';

/**
 * Load all knowledge documents from `<customizeDir>/knowledge/*.md`
 * (non-recursive).
 *
 * Behavior:
 *  - `knowledge/` directory absent → `[]` (no error, common legacy case).
 *  - `knowledge/` directory empty → `[]`.
 *  - Non-`.md` files ignored; subdirectories not recursed.
 *  - Per-file read failure → warning + skip; other files still loaded.
 *  - UTF-8 BOM stripped; frontmatter (if present) parsed and stripped.
 *
 * Files are returned in filename-lexicographic order (deterministic).
 *
 * @param customizeDir Absolute path to the customize directory.
 * @returns Loaded knowledge documents (possibly empty, never undefined).
 */
export async function loadKnowledge(customizeDir: string): Promise<KnowledgeDocument[]> {
  const knowledgeDir = resolve(customizeDir, 'knowledge');

  let entries: string[];
  try {
    entries = await readdir(knowledgeDir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    // ENOENT: directory doesn't exist — silent no-op (common case).
    if (code !== 'ENOENT') {
      log.warn('customize', 'knowledge-readdir-failed', {
        dir: knowledgeDir,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return [];
  }

  // Filter: top-level .md files only (non-recursive). Filter out
  // subdirectories by stat-checking each entry.
  const mdFiles: string[] = [];
  for (const entry of entries) {
    if (extname(entry).toLowerCase() !== '.md') continue;
    const fullPath = resolve(knowledgeDir, entry);
    try {
      const stats = await stat(fullPath);
      if (!stats.isFile()) continue;
      mdFiles.push(entry);
    } catch {
      // stat failed (race: file deleted between readdir and stat) — skip.
      log.warn('customize', 'knowledge-stat-failed', { path: fullPath });
    }
  }

  // Deterministic ordering: filename lexicographic ascending.
  mdFiles.sort();

  const docs: KnowledgeDocument[] = [];
  for (const filename of mdFiles) {
    const fullPath = resolve(knowledgeDir, filename);
    const doc = await loadKnowledgeFile(fullPath, filename);
    if (doc) docs.push(doc);
  }

  if (docs.length > 0) {
    log.info('customize', 'knowledge-loaded', {
      dir: knowledgeDir,
      count: docs.length,
      names: docs.map((d) => d.name),
    });
  }

  return docs;
}

/**
 * Load a single knowledge file. Never throws: read/parse failures log a
 * warning and return `undefined` so the caller can continue with the other
 * files.
 */
async function loadKnowledgeFile(
  fullPath: string,
  filename: string,
): Promise<KnowledgeDocument | undefined> {
  let raw: string;
  try {
    raw = await readFile(fullPath, 'utf8');
  } catch (err) {
    log.warn('customize', 'knowledge-read-failed', {
      path: fullPath,
      err: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }

  // Strip UTF-8 BOM if present.
  const text = raw.startsWith(UTF8_BOM) ? raw.slice(UTF8_BOM.length) : raw;
  const stem = basename(filename, extname(filename));

  const { frontmatter, content } = parseFrontmatter(text);
  const name = nonEmpty(frontmatter.name) || stem;

  return {
    name,
    ...(nonEmpty(frontmatter.description) ? { description: frontmatter.description } : {}),
    content,
    charCount: content.length,
    sourceFile: fullPath,
  };
}

interface ParsedFrontmatter {
  name?: string;
  description?: string;
}

/**
 * Parse optional YAML frontmatter from the file body.
 *
 * Same parsing rules as `skills.ts`:
 *  - First line MUST be exactly `---`.
 *  - Find the next `---` line; everything between is parsed as flat
 *    `key: value` pairs (no nesting, no lists).
 *  - Only `name` and `description` fields are extracted — `whenToUse` and
 *    other keys are silently ignored (forward-compat).
 *  - Malformed frontmatter (no closing `---`, bad YAML) → degrade to
 *    "no frontmatter": return the entire file as `content` (including the
 *    `---` lines).
 *  - `name` / `description` values are trimmed; empty values are treated
 *    as missing.
 */
function parseFrontmatter(text: string): { frontmatter: ParsedFrontmatter; content: string } {
  // Must start with `---\n` (or be exactly `---` with no body, which is
  // degenerate but treated as no frontmatter).
  if (!text.startsWith(`${FRONTMATTER_DELIM}\n`)) {
    return { frontmatter: {}, content: text };
  }

  const lines = text.split('\n');
  // lines[0] === '---'. Find the closing '---' line.
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && line.trim() === FRONTMATTER_DELIM) {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    // No closing delimiter — treat entire file as content (no frontmatter).
    return { frontmatter: {}, content: text };
  }

  const fmLines = lines.slice(1, closeIdx);
  const frontmatter: ParsedFrontmatter = {};
  for (const line of fmLines) {
    // Skip blank lines / comments inside frontmatter.
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      // Not a `key: value` pair — treat as malformed frontmatter, degrade.
      return { frontmatter: {}, content: text };
    }
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key === 'name' || key === 'description') {
      frontmatter[key] = value;
    }
    // Unknown keys (including `whenToUse`) are silently ignored.
  }

  // Content starts after the closing `---` line, with one leading newline
  // stripped (the newline immediately after `---`).
  const contentLines = lines.slice(closeIdx + 1);
  // Strip exactly one leading newline if present (common case: `---\n[body]`).
  if (contentLines.length > 0 && contentLines[0] === '') {
    contentLines.shift();
  }
  const content = contentLines.join('\n');

  return { frontmatter, content };
}

/** Returns the string if non-empty (after trim), else undefined. */
function nonEmpty(s: string | undefined): string | undefined {
  return s && s.trim().length > 0 ? s.trim() : undefined;
}
