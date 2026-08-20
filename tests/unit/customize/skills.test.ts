import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadSkills } from '../../../src/customize/skills';

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'skills-test-'));
}

describe('loadSkills — directory scanning', () => {
  let customizeDir: string;

  beforeEach(async () => {
    customizeDir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(customizeDir, { recursive: true, force: true });
  });

  it('returns [] when skills/ directory does not exist', async () => {
    expect(await loadSkills(customizeDir)).toEqual([]);
  });

  it('returns [] when skills/ directory is empty', async () => {
    await mkdir(join(customizeDir, 'skills'));
    expect(await loadSkills(customizeDir)).toEqual([]);
  });

  it('loads multiple .md files in filename-lexicographic order', async () => {
    const skillsDir = join(customizeDir, 'skills');
    await mkdir(skillsDir);
    await writeFile(join(skillsDir, 'camera-doctor.md'), '# Camera');
    await writeFile(join(skillsDir, 'device-ssh.md'), '# SSH');
    await writeFile(join(skillsDir, 'feishu-docs.md'), '# Docs');

    const docs = await loadSkills(customizeDir);
    expect(docs.map((d) => d.name)).toEqual([
      'camera-doctor',
      'device-ssh',
      'feishu-docs',
    ]);
  });

  it('ignores non-.md files', async () => {
    const skillsDir = join(customizeDir, 'skills');
    await mkdir(skillsDir);
    await writeFile(join(skillsDir, 'notes.txt'), 'ignore me');
    await writeFile(join(skillsDir, 'README.md'), '# Readme');
    await writeFile(join(skillsDir, 'device-ssh.md'), '# SSH');

    const docs = await loadSkills(customizeDir);
    expect(docs.map((d) => d.name).sort()).toEqual(['README', 'device-ssh']);
  });

  it('does not recurse into subdirectories', async () => {
    const skillsDir = join(customizeDir, 'skills');
    await mkdir(skillsDir);
    await mkdir(join(skillsDir, 'archive'));
    await writeFile(join(skillsDir, 'archive', 'old-skill.md'), '# Old');
    await writeFile(join(skillsDir, 'device-ssh.md'), '# SSH');

    const docs = await loadSkills(customizeDir);
    expect(docs.map((d) => d.name)).toEqual(['device-ssh']);
  });

  it('uses filename stem (without extension) as default name', async () => {
    const skillsDir = join(customizeDir, 'skills');
    await mkdir(skillsDir);
    await writeFile(join(skillsDir, 'device-ssh.md'), 'no frontmatter');

    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('device-ssh');
    expect(doc.sourceFile).toBe(join(skillsDir, 'device-ssh.md'));
  });

  it('skips a file that fails to read, loads the rest', async () => {
    const skillsDir = join(customizeDir, 'skills');
    await mkdir(skillsDir);
    // Create a directory named `bad.md` — readFile will fail with EISDIR.
    await mkdir(join(skillsDir, 'bad.md'));
    await writeFile(join(skillsDir, 'good.md'), 'good body');

    const docs = await loadSkills(customizeDir);
    expect(docs.map((d) => d.name)).toEqual(['good']);
  });
});

describe('loadSkills — frontmatter parsing', () => {
  let customizeDir: string;

  beforeEach(async () => {
    customizeDir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(customizeDir, { recursive: true, force: true });
  });

  async function writeSkill(name: string, content: string): Promise<void> {
    const skillsDir = join(customizeDir, 'skills');
    await mkdir(skillsDir, { recursive: true });
    await writeFile(join(skillsDir, name), content, 'utf8');
  }

  it('parses complete frontmatter (name/description/whenToUse)', async () => {
    await writeSkill(
      'device-ssh.md',
      '---\nname: device-ssh\ndescription: 设备免密接入\nwhenToUse: 接到报障需要 SSH 时\n---\n# SSH 免密\n\n操作步骤...',
    );
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('device-ssh');
    expect(doc.description).toBe('设备免密接入');
    expect(doc.whenToUse).toBe('接到报障需要 SSH 时');
    expect(doc.content).toBe('# SSH 免密\n\n操作步骤...');
    expect(doc.charCount).toBe(doc.content.length);
  });

  it('falls back to filename stem when no frontmatter', async () => {
    await writeSkill('device-ssh.md', '# SSH\n\n操作步骤');
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('device-ssh');
    expect(doc.description).toBeUndefined();
    expect(doc.whenToUse).toBeUndefined();
    expect(doc.content).toBe('# SSH\n\n操作步骤');
  });

  it('handles frontmatter with only name field', async () => {
    await writeSkill('device-ssh.md', '---\nname: custom-name\n---\nbody');
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('custom-name');
    expect(doc.description).toBeUndefined();
    expect(doc.whenToUse).toBeUndefined();
    expect(doc.content).toBe('body');
  });

  it('falls back to filename stem when frontmatter name is empty', async () => {
    await writeSkill('device-ssh.md', '---\nname: \n---\nbody');
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('device-ssh');
  });

  it('falls back to filename stem when frontmatter name is whitespace-only', async () => {
    await writeSkill('device-ssh.md', '---\nname:   \n---\nbody');
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('device-ssh');
  });

  it('degrades to "no frontmatter" when closing --- is missing', async () => {
    // No closing delimiter — entire file (including the leading `---` line)
    // becomes content. Name falls back to filename stem.
    await writeSkill('device-ssh.md', '---\nname: never-closes\nbody content');
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('device-ssh');
    expect(doc.description).toBeUndefined();
    // Content includes the `---` line because frontmatter was malformed.
    expect(doc.content).toContain('---');
    expect(doc.content).toContain('name: never-closes');
    expect(doc.content).toContain('body content');
  });

  it('degrades when frontmatter has non-key:value line', async () => {
    // A line without `:` → malformed frontmatter → degrade.
    await writeSkill('device-ssh.md', '---\nthis is not yaml\n---\nbody');
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('device-ssh');
    expect(doc.content).toContain('this is not yaml');
  });

  it('ignores unknown frontmatter keys', async () => {
    await writeSkill(
      'device-ssh.md',
      '---\nname: device-ssh\nversion: 2\nauthor: someone\n---\nbody',
    );
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('device-ssh');
    // Unknown fields are silently dropped — no description / whenToUse set.
    expect(doc.description).toBeUndefined();
    expect(doc.whenToUse).toBeUndefined();
    expect(doc.content).toBe('body');
  });

  it('skips blank lines and comments inside frontmatter', async () => {
    await writeSkill(
      'device-ssh.md',
      '---\n# this is a comment\n\nname: device-ssh\n---\nbody',
    );
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.name).toBe('device-ssh');
    expect(doc.content).toBe('body');
  });
});

describe('loadSkills — file read boundaries', () => {
  let customizeDir: string;

  beforeEach(async () => {
    customizeDir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(customizeDir, { recursive: true, force: true });
  });

  it('strips UTF-8 BOM before parsing', async () => {
    const skillsDir = join(customizeDir, 'skills');
    await mkdir(skillsDir);
    const body = '# SSH\n\ncontent';
    // Write with BOM prefix.
    await writeFile(join(skillsDir, 'device-ssh.md'), `\uFEFF${body}`, 'utf8');
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.content).toBe(body);
    expect(doc.charCount).toBe(body.length);
    // BOM should NOT appear in content.
    expect(doc.content.startsWith('\uFEFF')).toBe(false);
  });

  it('attaches retrieval metadata and trigger terms', async () => {
    const skillsDir = join(customizeDir, 'skills');
    await mkdir(skillsDir);
    await writeFile(
      join(skillsDir, 'device-ssh.md'),
      '---\nname: Device SSH\ndescription: Connect to devices\nwhenToUse: ssh, 连接, device\n---\n\nUse ssh.\n',
      'utf8',
    );

    const docs = await loadSkills(customizeDir);
    expect(docs[0]?.metadata).toEqual({
      id: 'device.ssh',
      relativePath: 'device-ssh.md',
      searchText: expect.stringContaining('device ssh'),
    });
    expect(docs[0]?.metadata?.searchText).toContain('connect to devices');
    expect(docs[0]?.triggers).toEqual(['ssh', '连接', 'device']);
  });

  it('preserves markdown structure verbatim (headers, code blocks, lists)', async () => {
    const skillsDir = join(customizeDir, 'skills');
    await mkdir(skillsDir);
    const body = '# Title\n\n```bash\nssh user@host\n```\n\n- item 1\n- item 2\n';
    await writeFile(join(skillsDir, 'device-ssh.md'), body, 'utf8');
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.content).toBe(body);
  });

  it('preserves internal whitespace and newlines', async () => {
    const skillsDir = join(customizeDir, 'skills');
    await mkdir(skillsDir);
    const body = 'line 1\n\n\nline 2\n   indented\n';
    await writeFile(join(skillsDir, 'device-ssh.md'), body, 'utf8');
    const docs = await loadSkills(customizeDir);
    const doc = docs[0]!;
    expect(doc.content).toBe(body);
  });
});
