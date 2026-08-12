import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadPersona } from '../../../src/customize/persona';

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'persona-test-'));
}

describe('loadPersona', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns undefined when SOUL.md is absent', async () => {
    expect(await loadPersona(dir)).toBeUndefined();
  });

  it('returns undefined when SOUL.md is empty (0 bytes)', async () => {
    await writeFile(join(dir, 'SOUL.md'), '');
    expect(await loadPersona(dir)).toBeUndefined();
  });

  it('returns undefined when SOUL.md is whitespace-only', async () => {
    await writeFile(join(dir, 'SOUL.md'), '   \n\n\t  \n');
    expect(await loadPersona(dir)).toBeUndefined();
  });

  it('strips UTF-8 BOM and loads the body verbatim', async () => {
    const body = '你是一名资深 SRE。';
    // Write with BOM prefix.
    await writeFile(join(dir, 'SOUL.md'), `\uFEFF${body}`, 'utf8');
    const persona = await loadPersona(dir);
    expect(persona).toBeDefined();
    expect(persona?.content).toBe(body);
    expect(persona?.charCount).toBe(body.length);
    expect(persona?.preview).toBe(body);
    expect(persona?.sourceFile).toBe(join(dir, 'SOUL.md'));
  });

  it('loads a normal file and preserves internal whitespace', async () => {
    const body = '# Persona\n\nLine 1\n\nLine 2\n';
    await writeFile(join(dir, 'SOUL.md'), body, 'utf8');
    const persona = await loadPersona(dir);
    expect(persona?.content).toBe(body);
    expect(persona?.charCount).toBe(body.length);
  });

  it('truncates preview to 200 chars with trailing ellipsis', async () => {
    const long = 'A'.repeat(500);
    await writeFile(join(dir, 'SOUL.md'), long, 'utf8');
    const persona = await loadPersona(dir);
    expect(persona?.preview.length).toBe(201); // 200 + '…'
    expect(persona?.preview.endsWith('…')).toBe(true);
    expect(persona?.charCount).toBe(500);
  });

  it('keeps preview equal to content when shorter than 200 chars', async () => {
    const body = 'short body';
    await writeFile(join(dir, 'SOUL.md'), body, 'utf8');
    const persona = await loadPersona(dir);
    expect(persona?.preview).toBe(body);
  });
});
