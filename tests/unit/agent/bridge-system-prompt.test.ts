import { describe, expect, it } from 'vitest';
import {
  BRIDGE_SYSTEM_PROMPT,
  buildBridgeSystemPrompt,
  prefixBridgeSystemPrompt,
} from '../../../src/agent/bridge-system-prompt';

describe('bridge system prompt bot collaboration rules', () => {
  it('states that bots only receive messages via a real structured mention', () => {
    expect(BRIDGE_SYSTEM_PROMPT).toContain('只有被真实 @');
    expect(BRIDGE_SYSTEM_PROMPT).toContain('收不到');
  });

  it('scopes the mention requirement to bots, not human users', () => {
    expect(BRIDGE_SYSTEM_PROMPT).toContain('人类用户');
  });

  it('tells the agent not to mention other bots by default to avoid loops', () => {
    expect(BRIDGE_SYSTEM_PROMPT).toContain('默认不要 @ 其他 bot');
    expect(BRIDGE_SYSTEM_PROMPT).toContain('死循环');
  });

  it('allows mentioning a bot when the user explicitly asks for a handoff', () => {
    expect(BRIDGE_SYSTEM_PROMPT).toContain('用户明确要求');
  });

  it('points self-identification at the bridge_context botOpenId field', () => {
    expect(BRIDGE_SYSTEM_PROMPT).toContain('botOpenId');
  });

  it('documents the senderType and mentions context fields', () => {
    expect(BRIDGE_SYSTEM_PROMPT).toContain('senderType');
    expect(BRIDGE_SYSTEM_PROMPT).toContain('mentions');
  });

  it('tells the agent not to mimic the batch sender annotation format', () => {
    expect(BRIDGE_SYSTEM_PROMPT).toContain('[名字 (user|bot)]');
    expect(BRIDGE_SYSTEM_PROMPT).toContain('不要模仿');
  });
});

describe('buildBridgeSystemPrompt', () => {
  it('returns the base prompt unchanged when no identity is available', () => {
    expect(buildBridgeSystemPrompt(undefined)).toBe(BRIDGE_SYSTEM_PROMPT);
  });

  it('appends a concrete identity line with open_id and name', () => {
    const prompt = buildBridgeSystemPrompt({ openId: 'ou_bot_self', name: '助手' });
    expect(prompt.startsWith(BRIDGE_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain('ou_bot_self');
    expect(prompt).toContain('助手');
  });

  it('appends the identity line even when the bot name is missing', () => {
    const prompt = buildBridgeSystemPrompt({ openId: 'ou_bot_self' });
    expect(prompt).toContain('ou_bot_self');
  });
});

describe('prefixBridgeSystemPrompt', () => {
  it('prefixes the identity-aware system prompt before the user message', () => {
    const prompt = prefixBridgeSystemPrompt('hello world', { openId: 'ou_bot_self' });
    expect(prompt).toContain('ou_bot_self');
    expect(prompt.indexOf('ou_bot_self')).toBeLessThan(prompt.indexOf('## user_message'));
    expect(prompt.endsWith('hello world')).toBe(true);
  });

  it('keeps working without an identity', () => {
    const prompt = prefixBridgeSystemPrompt('hello world', undefined);
    expect(prompt.startsWith(BRIDGE_SYSTEM_PROMPT)).toBe(true);
    expect(prompt.endsWith('hello world')).toBe(true);
  });
});

describe('buildBridgeSystemPrompt — persona injection', () => {
  it('appends <persona> block when customize.persona is present', () => {
    const prompt = buildBridgeSystemPrompt(
      { openId: 'ou_bot_self', name: '助手' },
      {
        persona: {
          content: '你是一名资深 SRE，专注于排障。',
          charCount: 19,
          preview: '你是一名资深 SRE，专注于排障。',
          sourceFile: '/tmp/SOUL.md',
        },
        skills: [],
        knowledge: [],
        dir: '/tmp/customize',
      },
    );
    // BRIDGE_SYSTEM_PROMPT verbatim, untouched.
    expect(prompt.startsWith(BRIDGE_SYSTEM_PROMPT)).toBe(true);
    // Identity line still present.
    expect(prompt).toContain('ou_bot_self');
    // Persona block appended after the identity line.
    expect(prompt).toContain('<persona>\n你是一名资深 SRE，专注于排障。\n</persona>');
    // Persona appears after the identity line.
    expect(prompt.indexOf('ou_bot_self')).toBeLessThan(prompt.indexOf('<persona>'));
  });

  it('omits <persona> block when customize is undefined', () => {
    const prompt = buildBridgeSystemPrompt({ openId: 'ou_bot_self' });
    expect(prompt).not.toContain('<persona>');
  });

  it('omits <persona> block when customize.persona is undefined', () => {
    const prompt = buildBridgeSystemPrompt(
      { openId: 'ou_bot_self' },
      { skills: [], knowledge: [], dir: '/tmp/customize' },
    );
    expect(prompt).not.toContain('<persona>');
  });

  it('keeps BRIDGE_SYSTEM_PROMPT content verbatim before any injected blocks', () => {
    const prompt = buildBridgeSystemPrompt(
      undefined,
      {
        persona: {
          content: 'persona body',
          charCount: 11,
          preview: 'persona body',
          sourceFile: '/tmp/SOUL.md',
        },
        skills: [],
        knowledge: [],
        dir: '/tmp/customize',
      },
    );
    // The base prompt is a verbatim prefix.
    expect(prompt.startsWith(BRIDGE_SYSTEM_PROMPT)).toBe(true);
    // The persona block comes strictly after the base prompt.
    expect(prompt.indexOf('<persona>')).toBeGreaterThan(BRIDGE_SYSTEM_PROMPT.length - 1);
  });
});

describe('prefixBridgeSystemPrompt — persona injection', () => {
  it('prefixes persona-aware system prompt before the user message', () => {
    const prompt = prefixBridgeSystemPrompt(
      'hello',
      { openId: 'ou_bot_self' },
      {
        persona: {
          content: 'persona body',
          charCount: 11,
          preview: 'persona body',
          sourceFile: '/tmp/SOUL.md',
        },
        skills: [],
        knowledge: [],
        dir: '/tmp/customize',
      },
    );
    expect(prompt).toContain('<persona>');
    expect(prompt.indexOf('<persona>')).toBeLessThan(prompt.indexOf('## user_message'));
    expect(prompt.endsWith('hello')).toBe(true);
  });
});

describe('buildBridgeSystemPrompt — skills injection', () => {
  const skillA = {
    name: 'device-ssh',
    content: '# SSH 免密接入\n\n步骤...',
    charCount: 16,
    sourceFile: '/tmp/skills/device-ssh.md',
  };
  const skillB = {
    name: 'camera-doctor',
    content: '摄像头诊断',
    charCount: 5,
    sourceFile: '/tmp/skills/camera-doctor.md',
  };

  it('injects <skills> block with each skill as <skill name="...">', () => {
    const prompt = buildBridgeSystemPrompt(
      { openId: 'ou_bot_self' },
      { skills: [skillA, skillB], knowledge: [], dir: '/tmp/customize' },
    );
    expect(prompt).toContain('<skills>');
    expect(prompt).toContain('</skills>');
    expect(prompt).toContain('<skill name="device-ssh">');
    expect(prompt).toContain('# SSH 免密接入\n\n步骤...');
    expect(prompt).toContain('<skill name="camera-doctor">');
    expect(prompt).toContain('摄像头诊断');
    // Skills appear in array order (caller is responsible for ordering).
    expect(prompt.indexOf('device-ssh')).toBeLessThan(prompt.indexOf('camera-doctor'));
  });

  it('injects empty <skills></skills> when skills array is empty', () => {
    const prompt = buildBridgeSystemPrompt(
      { openId: 'ou_bot_self' },
      { skills: [], knowledge: [], dir: '/tmp/customize' },
    );
    expect(prompt).toContain('<skills></skills>');
  });

  it('places <skills> after <persona> when both are present', () => {
    const prompt = buildBridgeSystemPrompt(
      { openId: 'ou_bot_self' },
      {
        persona: {
          content: 'persona body',
          charCount: 11,
          preview: 'persona body',
          sourceFile: '/tmp/SOUL.md',
        },
        skills: [skillA],
        knowledge: [],
        dir: '/tmp/customize',
      },
    );
    expect(prompt).toContain('<persona>');
    expect(prompt).toContain('<skills>');
    // persona must come before skills.
    expect(prompt.indexOf('<persona>')).toBeLessThan(prompt.indexOf('<skills>'));
  });

  it('injects <skills> immediately after BRIDGE_SYSTEM_PROMPT when persona is absent', () => {
    const prompt = buildBridgeSystemPrompt(
      undefined,
      { skills: [skillA], knowledge: [], dir: '/tmp/customize' },
    );
    expect(prompt.startsWith(BRIDGE_SYSTEM_PROMPT)).toBe(true);
    // No <persona> block (persona is undefined).
    expect(prompt).not.toContain('<persona>');
    // <skills> block still present.
    expect(prompt).toContain('<skills>');
    // <skills> comes after the base prompt.
    expect(prompt.indexOf('<skills>')).toBeGreaterThan(BRIDGE_SYSTEM_PROMPT.length - 1);
  });

  it('does not inject <skills> when customize is undefined (back-compat)', () => {
    const prompt = buildBridgeSystemPrompt({ openId: 'ou_bot_self' });
    expect(prompt).not.toContain('<skills>');
    expect(prompt).not.toContain('<persona>');
  });

  it('escapes XML special chars in skill name attribute', () => {
    const trickySkill = {
      name: 'name with "quotes" & <brackets>',
      content: 'body',
      charCount: 4,
      sourceFile: '/tmp/skills/tricky.md',
    };
    const prompt = buildBridgeSystemPrompt(
      undefined,
      { skills: [trickySkill], knowledge: [], dir: '/tmp/customize' },
    );
    // The raw name should not appear verbatim — it must be escaped.
    expect(prompt).not.toContain('name="name with "quotes"');
    // Escaped forms should appear.
    expect(prompt).toContain('&quot;');
    expect(prompt).toContain('&amp;');
    expect(prompt).toContain('&lt;');
    expect(prompt).toContain('&gt;');
  });
});

describe('buildBridgeSystemPrompt — knowledge injection', () => {
  const knowledgeA = {
    name: 'fault-dictionary',
    content: '# 故障字典\n\n故障 A...',
    charCount: 12,
    sourceFile: '/tmp/knowledge/fault-dictionary.md',
  };
  const knowledgeB = {
    name: 'sn-port-mapping',
    content: '| 端口 | 用途 |',
    charCount: 10,
    sourceFile: '/tmp/knowledge/sn-port-mapping.md',
  };

  it('injects <knowledge_base> block with each knowledge as <knowledge name="...">', () => {
    const prompt = buildBridgeSystemPrompt(
      undefined,
      {
        skills: [],
        knowledge: [knowledgeA, knowledgeB],
        dir: '/tmp/customize',
      },
    );
    expect(prompt).toContain('<knowledge_base>');
    expect(prompt).toContain('</knowledge_base>');
    expect(prompt).toContain('<knowledge name="fault-dictionary">');
    expect(prompt).toContain('# 故障字典');
    expect(prompt).toContain('<knowledge name="sn-port-mapping">');
    expect(prompt).toContain('| 端口 | 用途 |');
  });

  it('injects empty <knowledge_base></knowledge_base> when knowledge is empty', () => {
    const prompt = buildBridgeSystemPrompt(
      undefined,
      { skills: [], knowledge: [], dir: '/tmp/customize' },
    );
    expect(prompt).toContain('<knowledge_base></knowledge_base>');
  });

  it('places <knowledge_base> after <skills> when both are present', () => {
    const prompt = buildBridgeSystemPrompt(
      undefined,
      {
        skills: [
          { name: 's1', content: 'skill body', charCount: 9, sourceFile: '/tmp/s1.md' },
        ],
        knowledge: [knowledgeA],
        dir: '/tmp/customize',
      },
    );
    expect(prompt).toContain('<skills>');
    expect(prompt).toContain('<knowledge_base>');
    expect(prompt.indexOf('<skills>')).toBeLessThan(prompt.indexOf('<knowledge_base>'));
  });

  it('places <knowledge_base> after <persona> when skills is empty', () => {
    const prompt = buildBridgeSystemPrompt(
      undefined,
      {
        persona: {
          content: 'persona body',
          charCount: 11,
          preview: 'persona body',
          sourceFile: '/tmp/SOUL.md',
        },
        skills: [],
        knowledge: [knowledgeA],
        dir: '/tmp/customize',
      },
    );
    expect(prompt).toContain('<persona>');
    expect(prompt).toContain('<skills></skills>');
    expect(prompt).toContain('<knowledge_base>');
    // Order: persona < skills < knowledge_base
    expect(prompt.indexOf('<persona>')).toBeLessThan(prompt.indexOf('<skills>'));
    expect(prompt.indexOf('<skills>')).toBeLessThan(prompt.indexOf('<knowledge_base>'));
  });

  it('does not inject <knowledge_base> when customize is undefined', () => {
    const prompt = buildBridgeSystemPrompt({ openId: 'ou_bot_self' });
    expect(prompt).not.toContain('<knowledge_base>');
  });

  it('full prompt structure: BRIDGE → persona → skills → knowledge_base', () => {
    const prompt = buildBridgeSystemPrompt(
      { openId: 'ou_bot_self', name: '助手' },
      {
        persona: {
          content: 'persona body',
          charCount: 11,
          preview: 'persona body',
          sourceFile: '/tmp/SOUL.md',
        },
        skills: [
          { name: 'ssh', content: 'skill body', charCount: 10, sourceFile: '/tmp/ssh.md' },
        ],
        knowledge: [knowledgeA],
        dir: '/tmp/customize',
      },
    );
    // BRIDGE_SYSTEM_PROMPT is verbatim prefix.
    expect(prompt.startsWith(BRIDGE_SYSTEM_PROMPT)).toBe(true);
    // Identity line after BRIDGE.
    expect(prompt).toContain('ou_bot_self');
    // Persona block.
    expect(prompt).toContain('<persona>\npersona body\n</persona>');
    // Skills block.
    expect(prompt).toContain('<skill name="ssh">\nskill body\n</skill>');
    // Knowledge block.
    expect(prompt).toContain('<knowledge name="fault-dictionary">\n# 故障字典');
    // Verify full order.
    const bridgeEnd = BRIDGE_SYSTEM_PROMPT.length;
    const personaIdx = prompt.indexOf('<persona>');
    const skillsIdx = prompt.indexOf('<skills>');
    const knowledgeIdx = prompt.indexOf('<knowledge_base>');
    expect(bridgeEnd).toBeLessThan(personaIdx);
    expect(personaIdx).toBeLessThan(skillsIdx);
    expect(skillsIdx).toBeLessThan(knowledgeIdx);
  });

  it('falls back to full customize injection when retrieval is absent', () => {
    const prompt = buildBridgeSystemPrompt(
      undefined,
      {
        skills: [
          { name: 'alpha', content: 'skill alpha', charCount: 11, sourceFile: '/tmp/a.md' },
        ],
        knowledge: [
          { name: 'kb-a', content: 'knowledge alpha', charCount: 15, sourceFile: '/tmp/kb.md' },
        ],
        dir: '/tmp/customize',
      },
    );

    expect(prompt).toContain('<skill name="alpha">');
    expect(prompt).toContain('<knowledge name="kb-a">');
  });

  it('renders retrieved knowledge blocks instead of the full knowledge set', () => {
    const prompt = buildBridgeSystemPrompt(
      undefined,
      {
        skills: [
          { name: 'alpha', content: 'skill alpha', charCount: 11, sourceFile: '/tmp/a.md' },
          { name: 'beta', content: 'skill beta', charCount: 10, sourceFile: '/tmp/b.md' },
        ],
        knowledge: [
          { name: 'kb-a', content: 'knowledge alpha', charCount: 15, sourceFile: '/tmp/kb-a.md' },
          { name: 'kb-b', content: 'knowledge beta', charCount: 14, sourceFile: '/tmp/kb-b.md' },
        ],
        retrieved: {
          skills: [
            { name: 'alpha', content: 'skill alpha', charCount: 11, sourceFile: '/tmp/a.md' },
          ],
          knowledge: [
            { name: 'kb-a', content: 'knowledge alpha', charCount: 15, sourceFile: '/tmp/kb-a.md' },
          ],
          blocks: [
            {
              id: 'kb-a#chunk-0',
              documentId: 'kb-a',
              name: 'kb-a',
              kind: 'chunk',
              content: 'knowledge alpha',
              charCount: 15,
              sourceFile: '/tmp/kb-a.md',
              ordinal: 0,
            },
          ],
          trace: {
            query: 'alpha',
            selectedSkillIds: ['alpha'],
            selectedKnowledgeIds: ['kb-a'],
            selectedBlockIds: ['kb-a#chunk-0'],
            omittedKnowledgeIds: ['kb-b'],
            totalChars: 26,
            reason: 'selected by deterministic metadata relevance',
          },
        },
        dir: '/tmp/customize',
      },
    );

    expect(prompt).toContain('<skill name="alpha">');
    expect(prompt).not.toContain('<skill name="beta">');
    expect(prompt).toContain('<knowledge name="kb-a#kb-a#chunk-0">');
    expect(prompt).not.toContain('<knowledge name="kb-b">');
  });

  it('escapes XML special chars in knowledge name attribute', () => {
    const tricky = {
      name: 'name with "quotes" & <brackets>',
      content: 'body',
      charCount: 4,
      sourceFile: '/tmp/tricky.md',
    };
    const prompt = buildBridgeSystemPrompt(
      undefined,
      { skills: [], knowledge: [tricky], dir: '/tmp/customize' },
    );
    expect(prompt).not.toContain('name="name with "quotes"');
    expect(prompt).toContain('&quot;');
    expect(prompt).toContain('&amp;');
    expect(prompt).toContain('&lt;');
    expect(prompt).toContain('&gt;');
  });
});
