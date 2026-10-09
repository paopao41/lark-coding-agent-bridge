import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadKnowledge } from '../../../src/customize/knowledge';

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'knowledge-test-'));
}

describe('loadKnowledge — directory scanning', () => {
  let customizeDir: string;

  beforeEach(async () => {
    customizeDir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(customizeDir, { recursive: true, force: true });
  });

  it('returns [] when knowledge/ directory does not exist', async () => {
    expect(await loadKnowledge(customizeDir)).toEqual([]);
  });

  it('returns [] when knowledge/ directory is empty', async () => {
    await mkdir(join(customizeDir, 'knowledge'));
    expect(await loadKnowledge(customizeDir)).toEqual([]);
  });

  it('loads multiple .md files in filename-lexicographic order', async () => {
    const knowledgeDir = join(customizeDir, 'knowledge');
    await mkdir(knowledgeDir);
    await writeFile(join(knowledgeDir, 'sn-port-mapping.md'), '# SN Port');
    await writeFile(join(knowledgeDir, 'fault-dictionary.md'), '# Faults');

    const docs = await loadKnowledge(customizeDir);
    expect(docs.map((d) => d.name)).toEqual(['fault-dictionary', 'sn-port-mapping']);
  });

  it('ignores non-.md files', async () => {
    const knowledgeDir = join(customizeDir, 'knowledge');
    await mkdir(knowledgeDir);
    await writeFile(join(knowledgeDir, 'data.json'), '{}');
    await writeFile(join(knowledgeDir, 'fault-dictionary.md'), '# Faults');

    const docs = await loadKnowledge(customizeDir);
    expect(docs.map((d) => d.name)).toEqual(['fault-dictionary']);
  });

  it('recurses into subdirectories and loads nested .md files', async () => {
    const knowledgeDir = join(customizeDir, 'knowledge');
    await mkdir(knowledgeDir, { recursive: true });
    await mkdir(join(knowledgeDir, 'archive'), { recursive: true });
    await mkdir(join(knowledgeDir, 'camera', '内参'), { recursive: true });
    await writeFile(join(knowledgeDir, 'archive', 'old.md'), '# Old');
    await writeFile(join(knowledgeDir, 'camera', 'readme.md'), '# Camera');
    await writeFile(join(knowledgeDir, 'camera', '内参', 'readme.md'), '# Inner Params');
    await writeFile(join(knowledgeDir, 'fault-dictionary.md'), '# Faults');

    const docs = await loadKnowledge(customizeDir);
    // Relative-path-lexicographic ordering: archive/old.md, camera/内参/readme.md,
    // camera/readme.md, fault-dictionary.md (CJK codepoints sort after ASCII).
    expect(docs.map((d) => d.name)).toEqual(['old', 'readme', 'readme', 'fault-dictionary']);
    expect(docs[0]?.metadata?.relativePath).toBe('archive/old.md');
    expect(docs[0]?.metadata?.id).toBe('archive.old');
    expect(docs[0]?.sourceFile).toBe(join(knowledgeDir, 'archive', 'old.md'));
    expect(docs[1]?.metadata?.relativePath).toBe('camera/内参/readme.md');
    expect(docs[1]?.metadata?.id).toBe('camera.readme');
    expect(docs[2]?.metadata?.relativePath).toBe('camera/readme.md');
  });

  it('uses filename stem as default name', async () => {
    const knowledgeDir = join(customizeDir, 'knowledge');
    await mkdir(knowledgeDir);
    await writeFile(join(knowledgeDir, 'fault-dictionary.md'), 'no frontmatter');

    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('fault-dictionary');
    expect(doc.sourceFile).toBe(join(knowledgeDir, 'fault-dictionary.md'));
  });

  it('skips a file that fails to read, loads the rest', async () => {
    const knowledgeDir = join(customizeDir, 'knowledge');
    await mkdir(knowledgeDir);
    // Create a directory named `bad.md` — readFile will fail with EISDIR.
    await mkdir(join(knowledgeDir, 'bad.md'));
    await writeFile(join(knowledgeDir, 'good.md'), 'good body');

    const docs = await loadKnowledge(customizeDir);
    expect(docs.map((d) => d.name)).toEqual(['good']);
  });
});

describe('loadKnowledge — frontmatter parsing', () => {
  let customizeDir: string;

  beforeEach(async () => {
    customizeDir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(customizeDir, { recursive: true, force: true });
  });

  async function writeKnowledge(name: string, content: string): Promise<void> {
    const knowledgeDir = join(customizeDir, 'knowledge');
    await mkdir(knowledgeDir, { recursive: true });
    await writeFile(join(knowledgeDir, name), content, 'utf8');
  }

  it('parses complete frontmatter (name/description)', async () => {
    await writeKnowledge(
      'fault-dictionary.md',
      '---\nname: fault-dict\ndescription: 常见故障字典\n---\n# 故障列表\n\n...',
    );
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('fault-dict');
    expect(doc.description).toBe('常见故障字典');
    expect(doc.content).toBe('# 故障列表\n\n...');
    expect(doc.charCount).toBe(doc.content.length);
  });

  it('falls back to filename stem when no frontmatter', async () => {
    await writeKnowledge('fault-dictionary.md', '# 故障列表');
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('fault-dictionary');
    expect(doc.description).toBeUndefined();
    expect(doc.content).toBe('# 故障列表');
  });

  it('ignores whenToUse field even if present in frontmatter', async () => {
    await writeKnowledge(
      'fault-dictionary.md',
      '---\nname: fault-dict\nwhenToUse: this should be ignored\n---\nbody',
    );
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('fault-dict');
    // KnowledgeDocument has no whenToUse field — it should not appear.
    expect((doc as { whenToUse?: string }).whenToUse).toBeUndefined();
  });

  it('falls back to filename stem when frontmatter name is empty', async () => {
    await writeKnowledge('fault-dictionary.md', '---\nname: \n---\nbody');
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('fault-dictionary');
  });

  it('degrades to "no frontmatter" when closing --- is missing', async () => {
    await writeKnowledge('fault-dictionary.md', '---\nname: never-closes\nbody content');
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('fault-dictionary');
    expect(doc.description).toBeUndefined();
    // Content includes the `---` line because frontmatter was malformed.
    expect(doc.content).toContain('---');
    expect(doc.content).toContain('name: never-closes');
    expect(doc.content).toContain('body content');
  });

  it('degrades when frontmatter has non-key:value line', async () => {
    await writeKnowledge('fault-dictionary.md', '---\nthis is not yaml\n---\nbody');
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('fault-dictionary');
    expect(doc.content).toContain('this is not yaml');
  });

  it('ignores unknown frontmatter keys', async () => {
    await writeKnowledge(
      'fault-dictionary.md',
      '---\nname: fault-dict\nversion: 2\nauthor: someone\n---\nbody',
    );
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('fault-dict');
    expect(doc.description).toBeUndefined();
    expect(doc.content).toBe('body');
  });

  it('parses comma-separated tags into searchText', async () => {
    await writeKnowledge(
      'fault-dictionary.md',
      '---\nname: fault-dict\ndescription: Error lookup table\ntags: udas, moz\n---\nbody',
    );
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.metadata?.searchText).toContain('udas');
    expect(doc.metadata?.searchText).toContain('moz');
    expect(doc.content).toBe('body');
  });

  it('parses YAML list style tags', async () => {
    await writeKnowledge(
      'fault-dictionary.md',
      '---\nname: fault-dict\ntags:\n- UDAS\n- moz\n---\nbody',
    );
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.metadata?.searchText).toContain('udas');
    expect(doc.metadata?.searchText).toContain('moz');
  });
});

describe('loadKnowledge — file read boundaries', () => {
  let customizeDir: string;

  beforeEach(async () => {
    customizeDir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(customizeDir, { recursive: true, force: true });
  });

  it('strips UTF-8 BOM before parsing', async () => {
    const knowledgeDir = join(customizeDir, 'knowledge');
    await mkdir(knowledgeDir);
    const body = '# 故障列表\n\ncontent';
    await writeFile(join(knowledgeDir, 'fault-dictionary.md'), `\uFEFF${body}`, 'utf8');
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.content).toBe(body);
    expect(doc.charCount).toBe(body.length);
    expect(doc.content.startsWith('\uFEFF')).toBe(false);
  });

  it('attaches retrieval metadata and bounded blocks', async () => {
    const knowledgeDir = join(customizeDir, 'knowledge');
    await mkdir(knowledgeDir);
    await writeFile(
      join(knowledgeDir, 'fault-dictionary.md'),
      '---\nname: Fault Dictionary\ndescription: Error lookup table\n---\n\n# Errors\n\nE001 means low battery.\n\nE002 means timeout.\n',
      'utf8',
    );

    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.metadata).toEqual({
      id: 'fault.dictionary',
      relativePath: 'fault-dictionary.md',
      searchText: expect.stringContaining('fault dictionary'),
    });
    expect(doc.metadata?.searchText).toContain('error lookup table');
    expect(doc.blocks?.map((block) => block.id)).toEqual([
      'fault.dictionary.1',
      'fault.dictionary.2',
      'fault.dictionary.3',
    ]);
    expect(doc.blocks?.[0]).toMatchObject({
      documentId: 'fault.dictionary',
      name: 'Fault Dictionary',
      kind: 'chunk',
      ordinal: 0,
    });
  });

  it('preserves markdown tables verbatim', async () => {
    const knowledgeDir = join(customizeDir, 'knowledge');
    await mkdir(knowledgeDir);
    const body = '| 端口 | 用途 |\n|------|------|\n| 22   | SSH  |\n';
    await writeFile(join(knowledgeDir, 'sn-port-mapping.md'), body, 'utf8');
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.content).toBe(body);
  });

  it('preserves code blocks and lists', async () => {
    const knowledgeDir = join(customizeDir, 'knowledge');
    await mkdir(knowledgeDir);
    const body = '# Reference\n\n```bash\ncommand --flag\n```\n\n- item 1\n- item 2\n';
    await writeFile(join(knowledgeDir, 'manual.md'), body, 'utf8');
    const docs = await loadKnowledge(customizeDir);
    const doc = docs[0]!;
    expect(doc.content).toBe(body);
  });
});
