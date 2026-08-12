import { isAbsolute, resolve } from 'node:path';

import type { CustomizeConfig } from './types';

/**
 * Resolve the customize directory for a profile.
 *
 * Resolution rules:
 *  1. If `customizeConfig.dir` is an absolute path, use it verbatim.
 *  2. Otherwise, fall back to `<profileDir>/customize/`.
 *
 * Relative `dir` values are rejected by `normalizeCustomize` at config load
 * time, so by the time we reach here `dir` is either undefined or absolute.
 * This function still defends against a relative path slipping through
 * (treats it as if `dir` were undefined) so a corrupt config can't crash
 * the loader.
 *
 * The returned path is normalized via `resolve()` but NOT checked for
 * existence — callers (loader) handle missing directories gracefully.
 */
export function resolveCustomizeDir(
  profileDir: string,
  customizeConfig: CustomizeConfig | undefined,
): string {
  const override = customizeConfig?.dir;
  if (override && isAbsolute(override)) {
    return resolve(override);
  }
  return resolve(profileDir, 'customize');
}
