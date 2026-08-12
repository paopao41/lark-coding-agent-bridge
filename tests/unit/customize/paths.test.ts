import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveCustomizeDir } from '../../../src/customize/paths';
import { DEFAULT_CUSTOMIZE_CONFIG } from '../../../src/customize/types';

describe('resolveCustomizeDir', () => {
  const profileDir = resolve('/home/user/.lark-channel/profiles/claude');

  it('returns <profileDir>/customize/ by default', () => {
    expect(resolveCustomizeDir(profileDir, DEFAULT_CUSTOMIZE_CONFIG)).toBe(
      resolve(profileDir, 'customize'),
    );
  });

  it('returns <profileDir>/customize/ when customize config is undefined', () => {
    expect(resolveCustomizeDir(profileDir, undefined)).toBe(
      resolve(profileDir, 'customize'),
    );
  });

  it('overrides with absolute dir when provided', () => {
    const override = resolve('/etc/lark-channel/custom-share');
    expect(
      resolveCustomizeDir(profileDir, {
        enabled: true,
        dir: override,
      }),
    ).toBe(override);
  });

  it('falls back to <profileDir>/customize/ when dir is undefined (enabled true)', () => {
    expect(
      resolveCustomizeDir(profileDir, { enabled: true }),
    ).toBe(resolve(profileDir, 'customize'));
  });

  it('falls back to <profileDir>/customize/ even when disabled', () => {
    // resolveCustomizeDir is a pure path function; the enabled flag is
    // respected by the loader, not here. This makes the function's
    // behavior predictable for the env-var export path.
    expect(
      resolveCustomizeDir(profileDir, { enabled: false }),
    ).toBe(resolve(profileDir, 'customize'));
  });
});
