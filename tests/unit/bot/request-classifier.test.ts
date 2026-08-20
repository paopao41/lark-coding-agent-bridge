import { describe, expect, it } from 'vitest';

import { classifyRequest } from '../../../src/bot/request-classifier';
import type { CustomizeContext } from '../../../src/customize/types';

const customize: CustomizeContext = {
  skills: [
    {
      name: 'diagnose-network',
      description: 'Diagnose flaky network failures',
      whenToUse: 'debug, network, diagnose',
      content: 'Use this workflow when investigating connection errors.',
      charCount: 56,
      sourceFile: '/tmp/customize/skills/diagnose-network.md',
      metadata: {
        id: 'diagnose.network',
        relativePath: 'skills/diagnose-network.md',
        searchText: 'diagnose network flaky failures investigate connection errors',
      },
    },
  ],
  knowledge: [
    {
      name: 'ssh-errors',
      description: 'Common SSH error mapping',
      content: '# SSH\n\nConnection refused means the daemon is down.',
      charCount: 51,
      sourceFile: '/tmp/customize/knowledge/ssh-errors.md',
      metadata: {
        id: 'ssh.errors',
        relativePath: 'knowledge/ssh-errors.md',
        searchText: 'ssh errors common mapping connection refused daemon',
      },
      blocks: [
        {
          id: 'ssh.errors',
          documentId: 'ssh.errors',
          name: 'ssh-errors',
          kind: 'document',
          content: '# SSH\n\nConnection refused means the daemon is down.',
          charCount: 51,
          sourceFile: '/tmp/customize/knowledge/ssh-errors.md',
          relativePath: 'knowledge/ssh-errors.md',
          ordinal: 0,
        },
      ],
    },
  ],
  dir: '/tmp/customize',
};

describe('request classifier', () => {
  it('selects workflow skills for diagnostic requests', () => {
    const result = classifyRequest({
      prompt: 'Please diagnose the network error and debug the connection.',
      customize,
    });

    expect(result.workflow).toBe('hwato-diagnostic');
    expect(result.complexity).toBe('diagnostic');
    expect(result.toolNeed).toBe('tool-heavy');
    expect(result.selectedSkillIds).toEqual(['diagnose.network']);
    expect(result.selectedKnowledgeIds).toEqual(['ssh.errors']);
    expect(result.reason).toContain('diagnose.network');
  });

  it('falls back to simple handling for routine requests', () => {
    const result = classifyRequest({
      prompt: 'Thanks, please summarize the change.',
      customize: { skills: [], knowledge: [], dir: '/tmp/customize' },
    });

    expect(result.workflow).toBe('none');
    expect(result.complexity).toBe('simple');
    expect(result.toolNeed).toBe('none');
    expect(result.selectedSkillIds).toEqual([]);
    expect(result.selectedKnowledgeIds).toEqual([]);
  });
});
