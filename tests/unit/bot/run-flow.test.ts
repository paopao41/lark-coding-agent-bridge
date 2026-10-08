import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { claudeCapability } from '../../../src/agent/capability';
import { ActiveRuns } from '../../../src/bot/active-runs';
import { ProcessPool } from '../../../src/bot/process-pool';
import { startRunFlow } from '../../../src/bot/run-flow';
import type { RequestClassification } from '../../../src/bot/request-classifier';
import { createDefaultProfileConfig } from '../../../src/config/profile-schema';
import type { CustomizeContext } from '../../../src/customize/types';
import { RunExecutor } from '../../../src/runtime/run-executor';
import { SessionStore } from '../../../src/session/store';
import { WorkspaceStore } from '../../../src/workspace/store';
import { FakeAgentAdapter } from '../../helpers/fake-agent';
import { createTmpProfile, type TmpProfile } from '../../helpers/tmp-profile';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const customize: CustomizeContext = {
  skills: [],
  knowledge: [],
  dir: '/tmp/customize',
};

const diagnosticClassification: RequestClassification = {
  workflow: 'hwato-diagnostic',
  complexity: 'diagnostic',
  toolNeed: 'tool-heavy',
  selectedSkillIds: ['diagnose.network'],
  selectedKnowledgeIds: ['ssh.errors'],
  reason: 'matched diagnostic workflow hints',
};

describe('run flow classification forwarding', () => {
  it('accepts classification metadata without changing policy execution', async () => {
    const h = await createHarness({ defaultWorkspace: true });
    const workspaceRealpath = await realpath(h.tmp.workspace);

    const flow = await startRunFlow({
      scopeId: 'scope-classified',
      scope: { source: 'im', chatId: 'chat-1', actorId: 'ou_user' },
      prompt: 'diagnose network error',
      attachments: [],
      access: { ok: true, reason: 'allowed-user' },
      capability: claudeCapability(h.profileConfig),
      profileConfig: {
        ...h.profileConfig,
        preferences: {
          ...h.profileConfig.preferences,
          model: 'global.anthropic.claude-opus-5',
        },
      },
      sessions: h.sessions,
      workspaces: h.workspaces,
      executor: h.executor,
      now: 1000,
      customize,
      classification: diagnosticClassification,
    });

    expect(flow.ok).toBe(true);
    if (!flow.ok) throw new Error('expected run flow to start');
    expect(flow.cwdRealpath).toBe(workspaceRealpath);
    expect(h.agent.runOptions[0]).toMatchObject({
      runId: 'run-classified',
      cwd: workspaceRealpath,
      prompt: 'diagnose network error',
    });
    await collect(flow.execution.subscribe());
  });

  it('returns policy rejection before submitting even when classified', async () => {
    const h = await createHarness({ defaultWorkspace: true });

    const flow = await startRunFlow({
      scopeId: 'scope-rejected',
      scope: { source: 'im', chatId: 'chat-1', actorId: 'ou_user' },
      prompt: 'diagnose network error',
      attachments: [],
      access: { ok: false, reason: 'denied-user' },
      capability: claudeCapability(h.profileConfig),
      profileConfig: h.profileConfig,
      sessions: h.sessions,
      workspaces: h.workspaces,
      executor: h.executor,
      now: 1000,
      customize,
      classification: diagnosticClassification,
    });

    expect(flow).toMatchObject({
      ok: false,
      rejectReason: { code: 'access-denied' },
    });
    expect(h.agent.runOptions).toEqual([]);
  });

  it('forwards the configured model', async () => {
    const h = await createHarness({ defaultWorkspace: true });
    const flow = await startRunFlow({
      scopeId: 'scope-model',
      scope: { source: 'im', chatId: 'chat-1', actorId: 'ou_user' },
      prompt: 'hello',
      attachments: [],
      access: { ok: true, reason: 'allowed-user' },
      capability: claudeCapability(h.profileConfig),
      profileConfig: {
        ...h.profileConfig,
        preferences: {
          ...h.profileConfig.preferences,
          model: 'global.anthropic.claude-opus-5',
        },
      },
      sessions: h.sessions,
      workspaces: h.workspaces,
      executor: h.executor,
      now: 1000,
      customize,
    });

    expect(flow.ok).toBe(true);
    expect(h.agent.runOptions[0]?.model).toBe('global.anthropic.claude-opus-5');
  });
});

async function createHarness(options: { defaultWorkspace?: boolean } = {}): Promise<{
  tmp: TmpProfile;
  agent: FakeAgentAdapter;
  executor: RunExecutor;
  sessions: SessionStore;
  workspaces: WorkspaceStore;
  profileConfig: ReturnType<typeof createDefaultProfileConfig>;
}> {
  const tmp = await createTmpProfile('bridge-run-flow-classification-');
  const agent = new FakeAgentAdapter({
    events: [{ type: 'done', terminationReason: 'normal' }],
  });
  const executor = new RunExecutor({
    agent,
    pool: new ProcessPool(() => 1),
    activeRuns: new ActiveRuns(),
    createRunId: () => 'run-classified',
    now: () => 1000,
    postDoneExitGraceMs: 10,
  });
  const profileConfig = createDefaultProfileConfig({
    agentKind: 'claude',
    accounts: {
      app: {
        id: 'cli_test',
        secret: '${APP_SECRET}',
        tenant: 'feishu',
      },
    },
  });
  const sessions = new SessionStore(join(tmp.profile, 'sessions.json'));
  const workspaces = new WorkspaceStore(join(tmp.profile, 'workspaces.json'));
  cleanups.push(async () => {
    await Promise.all([sessions.flush(), workspaces.flush()]);
    await tmp.cleanup();
  });
  return {
    tmp,
    agent,
    executor,
    sessions,
    workspaces,
    profileConfig: {
      ...profileConfig,
      workspaces: {
        ...profileConfig.workspaces,
        ...(options.defaultWorkspace ? { default: tmp.workspace } : {}),
      },
    },
  };
}

async function collect(events: AsyncIterable<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const event of events) out.push(event);
  return out;
}
