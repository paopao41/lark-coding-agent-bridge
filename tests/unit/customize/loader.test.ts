import { mkdtemp, rm, writeFile, mkdir, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadCustomizeContext } from '../../../src/customize/loader';
import type { CustomizeConfig } from '../../../src/customize/types';

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'loader-test-'));
}

describe('loadCustomizeContext', () => {
  let profileDir: string;

  beforeEach(async () => {
    profileDir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(profileDir, { recursive: true, force: true });
  });

  it('returns empty context when customize is disabled', async () => {
    const dir = await makeTempDir();
    try {
      await mkdir(join(dir, 'customize'));
      const ctx = await loadCustomizeContext({
        profileDir: dir,
        customizeConfig: { enabled: false },
      });
      expect(ctx.persona).toBeUndefined();
      expect(ctx.skills).toEqual([]);
      expect(ctx.knowledge).toEqual([]);
      // dir is empty string when disabled.
      expect(ctx.dir).toBe('');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns empty context when customize dir does not exist', async () => {
    const ctx = await loadCustomizeContext({
      profileDir: profileDir,
      customizeConfig: { enabled: true },
    });
    expect(ctx.persona).toBeUndefined();
    expect(ctx.skills).toEqual([]);
    expect(ctx.knowledge).toEqual([]);
    expect(ctx.dir).toBe('');
  });

  it('returns empty context (with dir) when customize dir exists but SOUL.md is absent', async () => {
    await mkdir(join(profileDir, 'customize'));
    const ctx = await loadCustomizeContext({
      profileDir: profileDir,
      customizeConfig: { enabled: true },
    });
    expect(ctx.persona).toBeUndefined();
    expect(ctx.skills).toEqual([]);
    expect(ctx.knowledge).toEqual([]);
    expect(ctx.dir).toBe(join(profileDir, 'customize'));
  });

  it('loads persona when SOUL.md exists', async () => {
    const customizeDir = join(profileDir, 'customize');
    await mkdir(customizeDir);
    await writeFile(join(customizeDir, 'SOUL.md'), 'I am a bot.', 'utf8');
    const ctx = await loadCustomizeContext({
      profileDir: profileDir,
      customizeConfig: { enabled: true },
    });
    expect(ctx.persona?.content).toBe('I am a bot.');
    expect(ctx.dir).toBe(customizeDir);
  });

  it('respects absolute dir override', async () => {
    const overrideDir = await makeTempDir();
    try {
      await mkdir(join(overrideDir, 'skills'), { recursive: true });
      await writeFile(join(overrideDir, 'SOUL.md'), 'overridden', 'utf8');
      const config: CustomizeConfig = { enabled: true, dir: overrideDir };
      const ctx = await loadCustomizeContext({
        profileDir: profileDir,
        customizeConfig: config,
      });
      expect(ctx.persona?.content).toBe('overridden');
      expect(ctx.dir).toBe(overrideDir);
    } finally {
      await rm(overrideDir, { recursive: true, force: true });
    }
  });

  it('downgrades to undefined persona when SOUL.md read fails', async () => {
    // Create a directory named SOUL.md — readFile will fail with EISDIR.
    const customizeDir = join(profileDir, 'customize');
    await mkdir(customizeDir);
    await mkdir(join(customizeDir, 'SOUL.md'));
    const ctx = await loadCustomizeContext({
      profileDir: profileDir,
      customizeConfig: { enabled: true },
    });
    expect(ctx.persona).toBeUndefined();
    // Loader still returns the dir since the customize directory exists.
    expect(ctx.dir).toBe(customizeDir);
  });

  it('loads persona + skills together', async () => {
    const customizeDir = join(profileDir, 'customize');
    await mkdir(customizeDir);
    await mkdir(join(customizeDir, 'skills'));
    await writeFile(join(customizeDir, 'SOUL.md'), 'persona body', 'utf8');
    await writeFile(join(customizeDir, 'skills', 'device-ssh.md'), '# SSH', 'utf8');
    await writeFile(join(customizeDir, 'skills', 'camera-doctor.md'), '# Camera', 'utf8');
    const ctx = await loadCustomizeContext({
      profileDir: profileDir,
      customizeConfig: { enabled: true },
    });
    expect(ctx.persona?.content).toBe('persona body');
    expect(ctx.skills.map((s) => s.name)).toEqual(['camera-doctor', 'device-ssh']);
    expect(ctx.dir).toBe(customizeDir);
  });

  it('loads skills alone when SOUL.md is absent', async () => {
    const customizeDir = join(profileDir, 'customize');
    await mkdir(customizeDir);
    await mkdir(join(customizeDir, 'skills'));
    await writeFile(join(customizeDir, 'skills', 'device-ssh.md'), '# SSH', 'utf8');
    const ctx = await loadCustomizeContext({
      profileDir: profileDir,
      customizeConfig: { enabled: true },
    });
    expect(ctx.persona).toBeUndefined();
    expect(ctx.skills).toHaveLength(1);
    expect(ctx.skills[0]!.name).toBe('device-ssh');
  });

  it('returns empty skills when customize is disabled', async () => {
    const customizeDir = join(profileDir, 'customize');
    await mkdir(customizeDir);
    await mkdir(join(customizeDir, 'skills'));
    await writeFile(join(customizeDir, 'skills', 'device-ssh.md'), '# SSH', 'utf8');
    const ctx = await loadCustomizeContext({
      profileDir: profileDir,
      customizeConfig: { enabled: false },
    });
    expect(ctx.skills).toEqual([]);
    expect(ctx.persona).toBeUndefined();
    expect(ctx.dir).toBe('');
  });

  it('returns empty skills when customize dir exists but skills/ is absent', async () => {
    const customizeDir = join(profileDir, 'customize');
    await mkdir(customizeDir);
    // No skills/ subdirectory — skills should be empty, persona still loads.
    await writeFile(join(customizeDir, 'SOUL.md'), 'persona', 'utf8');
    const ctx = await loadCustomizeContext({
      profileDir: profileDir,
      customizeConfig: { enabled: true },
    });
    expect(ctx.skills).toEqual([]);
    expect(ctx.persona?.content).toBe('persona');
  });

  it('loads knowledge files from customize/knowledge/*.md', async () => {
    const customizeDir = join(profileDir, 'customize');
    await mkdir(join(customizeDir, 'knowledge'), { recursive: true });
    await writeFile(
      join(customizeDir, 'knowledge', 'fault-dictionary.md'),
      '---\nname: fault-dict\ndescription: 常见故障字典\n---\n# 故障列表',
      'utf8',
    );
    await writeFile(
      join(customizeDir, 'knowledge', 'sn-port-mapping.md'),
      '| 端口 | 用途 |',
      'utf8',
    );
    const ctx = await loadCustomizeContext({
      profileDir: profileDir,
      customizeConfig: { enabled: true },
    });
    expect(ctx.knowledge).toHaveLength(2);
    expect(ctx.knowledge[0]!.name).toBe('fault-dict');
    expect(ctx.knowledge[0]!.description).toBe('常见故障字典');
    expect(ctx.knowledge[1]!.name).toBe('sn-port-mapping');
  });

  it('returns empty knowledge when knowledge/ directory is absent', async () => {
    const customizeDir = join(profileDir, 'customize');
    await mkdir(customizeDir);
    // No knowledge/ subdirectory — knowledge should be empty.
    await writeFile(join(customizeDir, 'SOUL.md'), 'persona', 'utf8');
    const ctx = await loadCustomizeContext({
      profileDir: profileDir,
      customizeConfig: { enabled: true },
    });
    expect(ctx.knowledge).toEqual([]);
  });

  it('loads persona, skills, and knowledge together', async () => {
    const customizeDir = join(profileDir, 'customize');
    await mkdir(join(customizeDir, 'skills'), { recursive: true });
    await mkdir(join(customizeDir, 'knowledge'), { recursive: true });
    await writeFile(join(customizeDir, 'SOUL.md'), 'persona body', 'utf8');
    await writeFile(join(customizeDir, 'skills', 'ssh.md'), 'skill body', 'utf8');
    await writeFile(join(customizeDir, 'knowledge', 'faults.md'), 'knowledge body', 'utf8');
    const ctx = await loadCustomizeContext({
      profileDir: profileDir,
      customizeConfig: { enabled: true },
    });
    expect(ctx.persona?.content).toBe('persona body');
    expect(ctx.skills).toHaveLength(1);
    expect(ctx.skills[0]!.name).toBe('ssh');
    expect(ctx.knowledge).toHaveLength(1);
    expect(ctx.knowledge[0]!.name).toBe('faults');
  });
});
