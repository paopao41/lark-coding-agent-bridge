import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureKnowledgeIndex, knowledgeIndexPath, readKnowledgeIndex } from '../../../src/customize/knowledge-index';
import { loadCustomizeContext } from '../../../src/customize/loader';

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'knowledge-index-test-'));
}

describe('knowledge index', () => {
  let profileDir: string;
  let customizeDir: string;
  let cacheDir: string;

  beforeEach(async () => {
    profileDir = await makeTempDir();
    customizeDir = join(profileDir, 'customize');
    cacheDir = join(profileDir, 'cache');
    await mkdir(join(customizeDir, 'knowledge'), { recursive: true });
  });

  afterEach(async () => {
    await rm(profileDir, { recursive: true, force: true });
  });

  it('builds an index file from knowledge sources', async () => {
    await writeFile(
      join(customizeDir, 'knowledge', 'faults.md'),
      '---\nname: Fault Dictionary\n---\n\n# SSH\n\nCheck port 22.\n',
      'utf8',
    );

    const result = await ensureKnowledgeIndex({
      profile: 'claude',
      profileDir,
      cacheDir,
      customizeConfig: { enabled: true },
    });

    expect(result.rebuilt).toBe(true);
    expect(result.reason).toBe('missing-index');

    const index = await readKnowledgeIndex(knowledgeIndexPath(cacheDir));
    expect(index?.documents).toHaveLength(1);
    expect(index?.stats.documents).toBe(1);
    expect(index?.stats.blocks).toBeGreaterThan(0);
  });

  it('reuses a fresh index when sources are unchanged', async () => {
    await writeFile(join(customizeDir, 'knowledge', 'faults.md'), '# A\n\nB\n', 'utf8');

    const first = await ensureKnowledgeIndex({
      profile: 'claude',
      profileDir,
      cacheDir,
      customizeConfig: { enabled: true },
    });
    expect(first.rebuilt).toBe(true);

    const second = await ensureKnowledgeIndex({
      profile: 'claude',
      profileDir,
      cacheDir,
      customizeConfig: { enabled: true },
    });
    expect(second.rebuilt).toBe(false);
    expect(second.reason).toBe('fresh');
  });

  it('loader prefers the cached index when present', async () => {
    await writeFile(join(customizeDir, 'knowledge', 'faults.md'), '# A\n\nB\n', 'utf8');

    await ensureKnowledgeIndex({
      profile: 'claude',
      profileDir,
      cacheDir,
      customizeConfig: { enabled: true },
    });

    const ctx = await loadCustomizeContext({
      profileDir,
      customizeConfig: { enabled: true },
    });

    expect(ctx.knowledge).toHaveLength(1);
    expect(ctx.knowledge[0]?.name).toBe('faults');
    const idx = await readFile(knowledgeIndexPath(cacheDir), 'utf8');
    expect(idx).toContain('knowledge-index');
  });

  it('recurses into subdirectories and indexes nested .md files', async () => {
    const knowledgeDir = join(customizeDir, 'knowledge');
    await mkdir(join(knowledgeDir, 'camera', '内参'), { recursive: true });
    await mkdir(join(knowledgeDir, 'ptp'), { recursive: true });
    await writeFile(join(knowledgeDir, 'camera', 'readme.md'), '# Camera\n\nbody', 'utf8');
    await writeFile(join(knowledgeDir, 'camera', '内参', 'readme.md'), '# Inner Params', 'utf8');
    await writeFile(join(knowledgeDir, 'ptp', 'readme.md'), '# PTP', 'utf8');

    const result = await ensureKnowledgeIndex({
      profile: 'claude',
      profileDir,
      cacheDir,
      customizeConfig: { enabled: true },
    });

    expect(result.rebuilt).toBe(true);
    const index = await readKnowledgeIndex(knowledgeIndexPath(cacheDir));
    expect(index?.sources.map((s) => s.relativePath)).toEqual([
      'camera/内参/readme.md',
      'camera/readme.md',
      'ptp/readme.md',
    ]);
    expect(index?.documents).toHaveLength(3);
    expect(index?.stats.documents).toBe(3);
    expect(index?.stats.blocks).toBeGreaterThan(0);
    // sourceHash must NOT be the empty-string SHA-256.
    expect(index?.sourceHash).not.toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(index?.sourceHash.length).toBe(64);

    // Loader must surface the nested documents by relativePath.
    const ctx = await loadCustomizeContext({
      profileDir,
      customizeConfig: { enabled: true },
    });
    expect(ctx.knowledge).toHaveLength(3);
    expect(ctx.knowledge.map((d) => d.metadata?.relativePath)).toEqual([
      'camera/内参/readme.md',
      'camera/readme.md',
      'ptp/readme.md',
    ]);
  });
});
