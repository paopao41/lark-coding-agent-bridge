import { describe, expect, it } from 'vitest';

import { selectCustomizeRetrieval } from '../../../src/customize/retrieval';
import type { CustomizeContext } from '../../../src/customize/types';

const context: CustomizeContext = {
  skills: [
    {
      name: 'ssh-doctor',
      description: 'Diagnose SSH access failures',
      whenToUse: 'ssh connection refused login failures',
      content: 'Check daemon, port, and credentials.',
      charCount: 37,
      sourceFile: '/tmp/customize/skills/ssh-doctor.md',
      metadata: {
        id: 'ssh.doctor',
        relativePath: 'skills/ssh-doctor.md',
        searchText: 'ssh doctor diagnose access failures connection refused',
      },
    },
    {
      name: 'camera-doctor',
      description: 'Diagnose camera streams',
      content: 'Check RTSP stream and camera power.',
      charCount: 35,
      sourceFile: '/tmp/customize/skills/camera-doctor.md',
      metadata: {
        id: 'camera.doctor',
        relativePath: 'skills/camera-doctor.md',
        searchText: 'camera rtsp stream power',
      },
    },
  ],
  knowledge: [
    {
      name: 'ssh-errors',
      description: 'SSH error reference',
      content: '# SSH errors\n\nConnection refused usually means sshd is down.',
      charCount: 58,
      sourceFile: '/tmp/customize/knowledge/ssh-errors.md',
      metadata: {
        id: 'ssh.errors',
        relativePath: 'knowledge/ssh-errors.md',
        searchText: 'ssh errors connection refused sshd down',
      },
      blocks: [
        {
          id: 'ssh.errors#refused',
          documentId: 'ssh.errors',
          name: 'ssh-errors',
          kind: 'chunk',
          content: 'Connection refused usually means sshd is down.',
          charCount: 45,
          sourceFile: '/tmp/customize/knowledge/ssh-errors.md',
          relativePath: 'knowledge/ssh-errors.md',
          ordinal: 0,
        },
      ],
    },
    {
      name: 'camera-errors',
      description: 'Camera error reference',
      content: '# Camera errors\n\nBlack screen can mean missing power.',
      charCount: 52,
      sourceFile: '/tmp/customize/knowledge/camera-errors.md',
      metadata: {
        id: 'camera.errors',
        relativePath: 'knowledge/camera-errors.md',
        searchText: 'camera errors black screen missing power',
      },
    },
  ],
  dir: '/tmp/customize',
};

describe('customize retrieval', () => {
  it('selects bounded matching skills and knowledge blocks', () => {
    const result = selectCustomizeRetrieval({
      query: 'ssh connection refused debug',
      customize: context,
      maxSkills: 1,
      maxBlocks: 1,
      maxChars: 2_000,
    });

    expect(result.skills.map((skill) => skill.metadata?.id)).toEqual(['ssh.doctor']);
    expect(result.blocks.map((block) => block.id)).toEqual(['ssh.errors#refused']);
    expect(result.trace.selectedKnowledgeIds).toEqual(['ssh.errors']);
    expect(result.trace.omittedKnowledgeIds).toEqual(['camera.errors']);
    expect(result.trace.totalChars).toBeLessThan(2_000);
  });

  it('returns an empty retrieval result when no metadata matches', () => {
    const result = selectCustomizeRetrieval({
      query: 'hello there',
      customize: context,
    });

    expect(result.skills).toEqual([]);
    expect(result.blocks).toEqual([]);
    expect(result.knowledge).toEqual([]);
    expect(result.trace.reason).toContain('no metadata match');
  });
});
