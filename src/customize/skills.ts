import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, basename, extname, sep } from 'node:path';

import { log } from '../core/logger';
import type { SkillDocument } from './types';

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
 * Load all skill documents from `<customizeDir>/skills/*.md` (non-recursive).
 *
 * Behavior:
 *  - `skills/` directory absent → `[]` (no error, common legacy case).
 *  - `skills/` directory empty → `[]`.
 *  - Non-`.md` files ignored; subdirectories not recursed.
 *  - Per-file read failure → warning + skip; other files still loaded.
 *  - UTF-8 BOM stripped; frontmatter (if present) parsed and stripped.
 *
 * Files are returned in filename-lexicographic order (deterministic).
 *
 * @param customizeDir Absolute path to the customize directory.
 * @returns Loaded skill documents (possibly empty, never undefined).
 */
export async function loadSkills(customizeDir: string): Promise<SkillDocument[]> {
  const skillsDir = resolve(customizeDir, 'skills');

  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    // ENOENT: directory doesn't exist — silent no-op (common case).
    if (code !== 'ENOENT') {
      log.warn('customize', 'skills-readdir-failed', {
        dir: skillsDir,
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
    const fullPath = resolve(skillsDir, entry);
    try {
      const stats = await stat(fullPath);
      if (!stats.isFile()) continue;
      mdFiles.push(entry);
    } catch {
      // stat failed (race: file deleted between readdir and stat) — skip.
      log.warn('customize', 'skills-stat-failed', { path: fullPath });
    }
  }

  // Deterministic ordering: filename lexicographic ascending.
  mdFiles.sort();

  const docs: SkillDocument[] = [];
  for (const filename of mdFiles) {
    const fullPath = resolve(skillsDir, filename);
    const doc = await loadSkillFile(fullPath, filename);
    if (doc) docs.push(doc);
  }

  if (docs.length > 0) {
    log.info('customize', 'skills-loaded', {
      dir: skillsDir,
      count: docs.length,
      names: docs.map((d) => d.name),
    });
  }

  return docs;
}

/**
 * Load a single skill file. Never throws: read/parse failures log a warning
 * and return `undefined` so the caller can continue with the other files.
 */
async function loadSkillFile(
  fullPath: string,
  filename: string,
): Promise<SkillDocument | undefined> {
  let raw: string;
  try {
    raw = await readFile(fullPath, 'utf8');
  } catch (err) {
    log.warn('customize', 'skill-read-failed', {
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
  const triggers = parseTerms(frontmatter.whenToUse);
  const tags = frontmatter.tags ?? [];

  return {
    name,
    ...(nonEmpty(frontmatter.description) ? { description: frontmatter.description } : {}),
    ...(nonEmpty(frontmatter.whenToUse) ? { whenToUse: frontmatter.whenToUse } : {}),
    ...(triggers.length ? { triggers } : {}),
    content,
    charCount: content.length,
    sourceFile: fullPath,
    metadata: {
      id: documentId(filename),
      relativePath: filename.split(sep).join('/'),
      searchText: [name, frontmatter.description, frontmatter.whenToUse, filename, ...tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    },
  };
}

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  whenToUse?: string;
  /** Lowercase domain tags (e.g. `["udas", "moz"]`), parsed from `tags:`. */
  tags?: string[];
}

/**
 * Parse optional YAML frontmatter from the file body.
 *
 * Format:
 * ```
 * ---
 * name: device-ssh
 * description: 设备免密接入
 * whenToUse: 接到报障需要 SSH 时
 * tags: udas, moz
 * ---
 * [content]
 * ```
 *
 * Rules:
 *  - Frontmatter must start at the very first character (no leading
 *    whitespace/BOM — BOM is stripped before this function is called).
 *  - First line MUST be exactly `---` (after trimming trailing newline).
 *  - Find the next `---` line; everything between is parsed as flat
 *    `key: value` pairs (no nesting, no lists).
 *  - Malformed frontmatter (no closing `---`, bad YAML) → degrade to
 *    "no frontmatter": return the entire file as `content` (including the
 *    `---` lines).
 *  - `name` / `description` / `whenToUse` values are trimmed; empty values
 *    are treated as missing.
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
  // Tracks the last `key:` seen so `- item` lines can attach to it
  // (YAML list style, only collected for `tags`).
  let lastListKey: 'tags' | undefined;
  for (const line of fmLines) {
    // Skip blank lines / comments inside frontmatter.
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      // YAML list item — attach to the last list-capable key (tags only).
      if (lastListKey === 'tags') {
        const parsed = parseTagList(trimmed.slice(2));
        if (parsed.length > 0) frontmatter.tags = [...(frontmatter.tags ?? []), ...parsed];
      }
      continue;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      // Not a `key: value` pair — treat as malformed frontmatter, degrade.
      return { frontmatter: {}, content: text };
    }
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key === 'name' || key === 'description' || key === 'whenToUse') {
      frontmatter[key] = value;
      lastListKey = undefined;
    } else if (key === 'tags') {
      const parsed = parseTagList(value);
      if (parsed.length > 0) frontmatter.tags = [...(frontmatter.tags ?? []), ...parsed];
      lastListKey = 'tags';
    }
    // Unknown keys are silently ignored (forward-compat: we don't reject
    // frontmatter that has extra fields the loader doesn't recognize).
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

/** Returns a stable lowercase id derived from the source filename. */
function documentId(filename: string): string {
  return basename(filename, extname(filename))
    .replace(/[^A-Za-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase();
}

function parseTerms(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[，,、;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Returns the string if non-empty (after trim), else undefined. */
function nonEmpty(s: string | undefined): string | undefined {
  return s && s.trim().length > 0 ? s.trim() : undefined;
}

/**
 * Split a `tags` frontmatter value into lowercase tags.
 * Accepts comma / semicolon / whitespace separated values, e.g.
 * `tags: udas, moz` or `- udas` list items (each item re-split).
 */
function parseTagList(value: string): string[] {
  return value
    .split(/[,;，、\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}
