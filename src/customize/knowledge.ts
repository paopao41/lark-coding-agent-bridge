import { readdir, readFile } from 'node:fs/promises';
import { resolve, basename, extname, join, relative, sep } from 'node:path';

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
 * Load all knowledge documents from `<customizeDir>/knowledge/` and its
 * subdirectories (recursive; matches `.md` files at any depth).
 *
 * Behavior:
 *  - `knowledge/` directory absent → `[]` (no error, common legacy case).
 *  - `knowledge/` directory empty → `[]`.
 *  - Non-`.md` files ignored; subdirectories recursed.
 *  - Per-file read failure → warning + skip; other files still loaded.
 *  - UTF-8 BOM stripped; frontmatter (if present) parsed and stripped.
 *
 * Files are returned in relative-path-lexicographic order (deterministic),
 * where the relative path is POSIX-style (e.g. `camera/readme.md`).
 *
 * @param customizeDir Absolute path to the customize directory.
 * @returns Loaded knowledge documents (possibly empty, never undefined).
 */
export async function loadKnowledge(customizeDir: string): Promise<KnowledgeDocument[]> {
  const knowledgeDir = resolve(customizeDir, 'knowledge');

  let files: KnowledgeFileEntry[];
  try {
    files = await collectMarkdownFiles(knowledgeDir, knowledgeDir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      log.warn('customize', 'knowledge-readdir-failed', {
        dir: knowledgeDir,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return [];
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const docs: KnowledgeDocument[] = [];
  for (const file of files) {
    const doc = await loadKnowledgeFile(file.fullPath, file.relativePath);
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

interface KnowledgeFileEntry {
  /** POSIX-style path relative to the `knowledge/` directory. */
  relativePath: string;
  /** Absolute path to the file on disk. */
  fullPath: string;
}

/**
 * Recursively collect `*.md` files under `dir`, returning entries with
 * POSIX-style relative paths (relative to `baseDir`).
 *
 * Subdirectories are recursed; non-`.md` files are ignored. Directory
 * entries named like `bad.md` are treated as directories and recursed
 * (their contents, if any, are loaded — empty directories contribute
 * nothing).
 */
async function collectMarkdownFiles(
  dir: string,
  baseDir: string,
): Promise<KnowledgeFileEntry[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const acc: KnowledgeFileEntry[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectMarkdownFiles(fullPath, baseDir);
      acc.push(...nested);
      continue;
    }
    if (!entry.isFile()) continue;
    if (extname(entry.name).toLowerCase() !== '.md') continue;
    acc.push({
      relativePath: relative(baseDir, fullPath).split(sep).join('/'),
      fullPath,
    });
  }
  return acc;
}

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
    metadata: {
      id: documentId(filename),
      relativePath: filename.split(sep).join('/'),
      searchText: [name, frontmatter.description, filename, firstHeading(content)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    },
    blocks: splitKnowledgeBlocks(fullPath, filename, name, content),
  };
}

function splitKnowledgeBlocks(
  sourceFile: string,
  relativePath: string,
  name: string,
  content: string,
): KnowledgeDocument['blocks'] {
  const documentIdValue = documentId(relativePath);
  const normalizedPath = relativePath.split(sep).join('/');
  const paragraphs = content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const parts = paragraphs.length > 0 ? paragraphs : [content];
  return parts.map((part, index) => ({
    id: parts.length > 1 ? `${documentIdValue}.${index + 1}` : documentIdValue,
    documentId: documentIdValue,
    name,
    kind: parts.length > 1 ? 'chunk' : 'document',
    content: part,
    charCount: part.length,
    sourceFile,
    relativePath: normalizedPath,
    ordinal: index,
  }));
}

function documentId(relativePath: string): string {
  return relativePath
    .replace(/\.md$/i, '')
    .replace(/[^A-Za-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase();
}

function firstHeading(content: string): string | undefined {
  return content
    .split('\n')
    .find((line) => line.startsWith('# '))
    ?.replace(/^#+\s*/, '')
    .trim();
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
