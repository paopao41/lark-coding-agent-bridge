import { stat } from 'node:fs/promises';

import { log } from '../core/logger';
import type { CustomizeContext, CustomizeConfig } from './types';
import { resolveCustomizeDir } from './paths';
import { loadPersona } from './persona';
import { loadSkills } from './skills';
import { loadKnowledge } from './knowledge';

/**
 * Options for {@link loadCustomizeContext}.
 */
export interface LoadCustomizeContextOptions {
  /** Absolute path to the profile directory (`<profileDir>`). */
  profileDir: string;
  /** Per-profile customize config (from `ProfileConfig.customize`). */
  customizeConfig: CustomizeConfig;
}

/**
 * Load the customize context for a profile.
 *
 * Reads from the resolved customize directory:
 *  - `SOUL.md` → `persona` (optional)
 *  - `skills/*.md` → `skills` (Change 2)
 *  - `knowledge/*.md` → `knowledge` (Change 3)
 *
 * Behavior:
 *  - When `customizeConfig.enabled === false`, returns an empty context
 *    without touching the filesystem.
 *  - When the customize directory does not exist, returns an empty context
 *    (no error — the common case for legacy profiles).
 *  - Per-file failures are logged at `warn` level and skipped; the rest of
 *    the context is still returned.
 *
 * Loading is per-run: no in-process caching. Editing files on disk
 * between runs takes effect on the next run.
 */
export async function loadCustomizeContext(
  opts: LoadCustomizeContextOptions,
): Promise<CustomizeContext> {
  if (!opts.customizeConfig.enabled) {
    return emptyContext();
  }

  const customizeDir = resolveCustomizeDir(opts.profileDir, opts.customizeConfig);

  // Confirm the directory exists before descending into it; missing dir is
  // the common legacy case and not worth a warning.
  let dirExists: boolean;
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

  // Change 1: persona
  const persona = await loadPersona(customizeDir);

  // Change 2: skills.
  const skills = await loadSkills(customizeDir);

  // Change 3: knowledge.
  const knowledge = await loadKnowledge(customizeDir);

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
  });

  return ctx;
}

function emptyContext(): CustomizeContext {
  return { skills: [], knowledge: [], dir: '' };
}
