import { describe, expect, it } from 'vitest';
import { configFormCard, type ConfigFormOpts } from '../../../src/card/config-card';

const base: ConfigFormOpts = {
  agentKind: 'claude',
  mode: 'personal',
  model: 'default',
  messageReply: 'markdown',
  showToolCalls: false,
  cotMessages: 'off',
  maxConcurrentRuns: 1,
  runIdleTimeoutMinutes: 0,
  requireMentionInGroup: false,
  larkCliIdentity: 'bot-only',
  allowedUsers: [],
  allowedChats: [],
  admins: [],
  knownChats: [],
};

describe('configFormCard console URL', () => {
  it('shows the web console URL when one is running', () => {
    const url = 'http://127.0.0.1:53219/?token=abc123';
    const card = configFormCard({ ...base, consoleUrl: url });
    expect(JSON.stringify(card)).toContain(url);
    expect(JSON.stringify(card)).toContain('Web 控制台');
  });

  it('omits the console section when no console is running', () => {
    const card = configFormCard(base);
    expect(JSON.stringify(card)).not.toContain('Web 控制台');
  });
});

describe('configFormCard persona customize panel', () => {
  it('omits the persona panel when customize is undefined', () => {
    const card = configFormCard(base);
    expect(JSON.stringify(card)).not.toContain('人格定制');
    expect(JSON.stringify(card)).not.toContain('SOUL.md');
  });

  it('renders the panel with a loaded persona', () => {
    const card = configFormCard({
      ...base,
      customize: {
        enabled: true,
        soulPath: '/home/u/.lark-channel/profiles/p/customize/SOUL.md',
        charCount: 42,
        preview: '你是一名资深 SRE',
      },
    });
    const json = JSON.stringify(card);
    expect(json).toContain('人格定制');
    expect(json).toContain('/home/u/.lark-channel/profiles/p/customize/SOUL.md');
    expect(json).toContain('42');
    expect(json).toContain('你是一名资深 SRE');
    expect(json).toContain('已开启');
  });

  it('renders the panel with "(未创建)" when soulPath is null', () => {
    const card = configFormCard({
      ...base,
      customize: {
        enabled: true,
        soulPath: null,
        charCount: null,
        preview: null,
      },
    });
    const json = JSON.stringify(card);
    expect(json).toContain('人格定制');
    expect(json).toContain('（未创建）');
    expect(json).toContain('（未加载）');
    expect(json).toContain('（无内容）');
  });

  it('renders the disabled status when enabled=false', () => {
    const card = configFormCard({
      ...base,
      customize: {
        enabled: false,
        soulPath: '/tmp/SOUL.md',
        charCount: 10,
        preview: 'hello',
      },
    });
    const json = JSON.stringify(card);
    expect(json).toContain('已关闭');
    // Path / count / preview are still shown for context.
    expect(json).toContain('/tmp/SOUL.md');
  });
});

describe('configFormCard skills panel', () => {
  it('omits the skills panel when skills is undefined', () => {
    const card = configFormCard(base);
    expect(JSON.stringify(card)).not.toContain('技能清单');
  });

  it('lists each skill with name and char count when skills are loaded', () => {
    const card = configFormCard({
      ...base,
      skills: [
        { name: 'device-ssh', charCount: 1234, sourceFile: '/tmp/device-ssh.md' },
        { name: 'camera-doctor', charCount: 5678, sourceFile: '/tmp/camera-doctor.md' },
        { name: 'feishu-docs', charCount: 901, sourceFile: '/tmp/feishu-docs.md' },
      ],
    });
    const json = JSON.stringify(card);
    expect(json).toContain('技能清单');
    expect(json).toContain('device-ssh');
    expect(json).toContain('1234');
    expect(json).toContain('camera-doctor');
    expect(json).toContain('5678');
    expect(json).toContain('feishu-docs');
    expect(json).toContain('901');
    expect(json).toContain('字符');
  });

  it('shows the activation hint when skills array is empty', () => {
    const card = configFormCard({ ...base, skills: [] });
    const json = JSON.stringify(card);
    expect(json).toContain('技能清单');
    expect(json).toContain('创建 customize/skills/*.md 以激活技能注入');
  });

  it('renders below the persona panel when both are present', () => {
    const card = configFormCard({
      ...base,
      customize: {
        enabled: true,
        soulPath: '/tmp/SOUL.md',
        charCount: 10,
        preview: 'persona body',
      },
      skills: [{ name: 'device-ssh', charCount: 5, sourceFile: '/tmp/device-ssh.md' }],
    });
    const json = JSON.stringify(card);
    const personaIdx = json.indexOf('人格定制');
    const skillsIdx = json.indexOf('技能清单');
    expect(personaIdx).toBeGreaterThan(-1);
    expect(skillsIdx).toBeGreaterThan(-1);
    expect(personaIdx).toBeLessThan(skillsIdx);
  });
});

describe('configFormCard knowledge panel', () => {
  it('omits the knowledge panel when knowledge is undefined', () => {
    const card = configFormCard(base);
    expect(JSON.stringify(card)).not.toContain('知识库');
  });

  it('lists each knowledge with name, description, and char count', () => {
    const card = configFormCard({
      ...base,
      knowledge: [
        {
          name: 'fault-dictionary',
          description: '常见故障字典',
          charCount: 1234,
          sourceFile: '/tmp/fault-dictionary.md',
        },
        {
          name: 'sn-port-mapping',
          charCount: 567,
          sourceFile: '/tmp/sn-port-mapping.md',
        },
      ],
    });
    const json = JSON.stringify(card);
    expect(json).toContain('知识库');
    expect(json).toContain('fault-dictionary');
    expect(json).toContain('常见故障字典');
    expect(json).toContain('1234');
    expect(json).toContain('sn-port-mapping');
    expect(json).toContain('567');
    expect(json).toContain('字符');
    // Total char count.
    expect(json).toContain('1801');
    expect(json).toContain('总计');
  });

  it('shows the activation hint when knowledge array is empty', () => {
    const card = configFormCard({ ...base, knowledge: [] });
    const json = JSON.stringify(card);
    expect(json).toContain('知识库');
    expect(json).toContain('创建 customize/knowledge/*.md 以激活知识库注入');
  });

  it('renders below the skills panel when both are present', () => {
    const card = configFormCard({
      ...base,
      skills: [{ name: 'device-ssh', charCount: 5, sourceFile: '/tmp/device-ssh.md' }],
      knowledge: [
        {
          name: 'fault-dictionary',
          charCount: 10,
          sourceFile: '/tmp/fault-dictionary.md',
        },
      ],
    });
    const json = JSON.stringify(card);
    const skillsIdx = json.indexOf('技能清单');
    const knowledgeIdx = json.indexOf('知识库');
    expect(skillsIdx).toBeGreaterThan(-1);
    expect(knowledgeIdx).toBeGreaterThan(-1);
    expect(skillsIdx).toBeLessThan(knowledgeIdx);
  });
});
