import { stat } from 'node:fs/promises';

import { log } from '../core/logger';
import type { CustomizeContext, CustomizeConfig } from './types';
import { loadPersona } from './persona';
import { loadSkills } from './skills';
import { loadKnowledge } from './knowledge';
import { knowledgeIndexPath, loadKnowledgeFromIndex } from './knowledge-index';
import { resolveCustomizeDir } from './paths';

/**
 * Options for {@link loadCustomizeContext}.
 */
export interface LoadCustomizeContextOptions {
  /** Absolute path to the profile directory (`<profileDir>`). */
  profileDir: string;
  /** Optional profile cache directory (`<profileDir>/cache`). */
  cacheDir?: string;
  /** Per-profile customize config (from `ProfileConfig.customize`). */
  customizeConfig: CustomizeConfig;
}

/**
 * Load the customize context for a profile.
 *
 * Reads from the resolved customize directory:
 *  - `SOUL.md` → `persona` (optional)
 *  - `skills/*.md` → `skills`
 *  - `knowledge/*.md` → `knowledge`
 *
 * Behavior:
 *  - When `customizeConfig.enabled === false`, returns an empty context
 *    without touching the filesystem.
 *  - When the customize directory does not exist, returns an empty context
 *    (no error — the common case for legacy profiles).
 *  - Per-file failures are logged at `warn` level and skipped; the rest of
 *    the context is still returned.
 *  - Knowledge is loaded from the cached index when present, with a fallback
 *    to the source files if the index is missing or unreadable.
 */
export async function loadCustomizeContext(
  opts: LoadCustomizeContextOptions,
): Promise<CustomizeContext> {
  if (!opts.customizeConfig.enabled) {
    return emptyContext();
  }

  const customizeDir = resolveCustomizeDir(opts.profileDir, opts.customizeConfig);

  let dirExists = false;
  try {
    const stats = await stat(customizeDir);
    dirExists = stats.isDirectory();
  } catch {
    dirExists = false;
  }
  if (!dirExists) {
    return emptyContext();
  }

  log.info('customize', 'load-start', { dir: customizeDir });

  const persona = await loadPersona(customizeDir);
  const skills = await loadSkills(customizeDir);

  const indexPath = knowledgeIndexPath(opts.cacheDir ?? `${opts.profileDir}/cache`);
  const knowledgeFromIndex = await loadKnowledgeFromIndex(indexPath);
  const knowledge = knowledgeFromIndex ?? (await loadKnowledge(customizeDir));

  const ctx: CustomizeContext = {
    ...(persona ? { persona } : {}),
    skills,
    knowledge,
    dir: customizeDir,
  };

  log.info('customize', 'load-done', {
    dir: customizeDir,
    hasPersona: Boolean(persona),
    skillsCount: skills.length,
    knowledgeCount: knowledge.length,
    knowledgeSource: knowledgeFromIndex ? 'index' : 'source',
  });

  return ctx;
}

function emptyContext(): CustomizeContext {
  return { skills: [], knowledge: [], dir: '' };
}
