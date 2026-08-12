import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { log } from '../core/logger';
import type { PersonaContent } from './types';

/**
 * UTF-8 BOM byte sequence (0xEF 0xBB 0xBF), encoded here as the literal
 * string "\uFEFF" — `readFile(..., 'utf8')` decodes the BOM to U+FEFF.
 * Stripping it lets downstream XML/markdown parsers see the actual content
 * without a leading zero-width character that some tools reject.
 */
const UTF8_BOM = '\uFEFF';

/** Preview length cap (characters). Matches the `/config` card display. */
const PREVIEW_MAX_CHARS = 200;

/**
 * Load `SOUL.md` from the customize directory and return a `PersonaContent`.
 *
 * Behavior:
 *  - File absent → `undefined` (no persona).
 *  - Empty file (0 bytes) → `undefined`.
 *  - Whitespace-only file → `undefined` (treated as "no persona" per spec —
 *    we don't want `<persona>\n\n</persona>` in the system prompt).
 *  - Readable, non-empty file → `PersonaContent` with BOM stripped and
 *    internal whitespace preserved verbatim.
 *
 * Never throws: I/O failures log a warning and return `undefined` so the
 * agent run proceeds without persona injection.
 *
 * @param customizeDir Absolute path to the customize directory.
 * @returns Loaded persona, or `undefined` when absent / empty / unreadable.
 */
export async function loadPersona(customizeDir: string): Promise<PersonaContent | undefined> {
  const soulPath = resolve(customizeDir, 'SOUL.md');
  let raw: string;
  try {
    raw = await readFile(soulPath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    // ENOENT: file doesn't exist — silent no-op (the common case).
    if (code !== 'ENOENT') {
      log.warn('customize', 'persona-read-failed', {
        path: soulPath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return undefined;
  }

  // Strip UTF-8 BOM if present.
  const content = raw.startsWith(UTF8_BOM) ? raw.slice(UTF8_BOM.length) : raw;

  // Empty or whitespace-only → no persona (per spec).
  if (content.trim().length === 0) {
    return undefined;
  }

  return {
    content,
    charCount: content.length,
    preview: truncatePreview(content),
    sourceFile: soulPath,
  };
}

/**
 * Truncate to {@link PREVIEW_MAX_CHARS}, appending "…" if the content was
 * longer. Internal whitespace preserved (we don't collapse newlines / spaces
 * — the card renders markdown so the user sees what the file actually
 * contains).
 */
function truncatePreview(content: string): string {
  if (content.length <= PREVIEW_MAX_CHARS) return content;
  return `${content.slice(0, PREVIEW_MAX_CHARS)}…`;
}
