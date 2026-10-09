import { log } from '../core/logger';

/**
 * Per-scope "problem domain" presets selectable via the `/mode` command
 * (typically bound to Feishu bot menu entries that send `/mode udas` etc.).
 *
 * An active mode has two runtime effects (see bot/channel.ts runAgentBatch):
 *  1. A fixed instruction is prepended to every user prompt so the agent
 *     interprets follow-up messages within that problem domain without the
 *     user restating it.
 *  2. {@link ScopeModeDef.retrievalTerms} bias customize retrieval
 *     (skills/knowledge whose path/name/heading carry the term are
 *     force-selected regardless of the user message content).
 *
 * Lifetime: in-memory, scoped like sessions (`chatId`, or
 * `${chatId}:${threadId}` in topic groups). It lives with the session —
 * `/new` / `/cd` (session resets) clear it, and a bridge restart wipes it
 * naturally. `/mode off` is just an explicit shortcut, not the only exit.
 */
export type ScopeModeId = 'udas' | 'moz' | 'equip';

export interface ScopeModeDef {
  id: ScopeModeId;
  /** Alternative tokens accepted by `/mode` (e.g. `fixture` → equip). */
  aliases: string[];
  /** Human-readable label shown in command replies. */
  label: string;
  /** Instruction injected into each prompt while the mode is active. */
  instruction: string;
  /**
   * Lowercase terms used to force-match customize skills/knowledge while the
   * mode is active. Name domain docs with the term in filename/title
   * (e.g. `customize/knowledge/udas-gmsl.md`).
   */
  retrievalTerms: string[];
}

export const SCOPE_MODES: ScopeModeDef[] = [
  {
    id: 'udas',
    aliases: [],
    label: 'UDAS 问题定位',
    instruction:
      '本会话用户已通过菜单选择「UDAS 问题定位」模式。后续消息默认都在描述 UDAS 相关问题，' +
      '请直接按 UDAS 故障定位思路分析，优先使用 UDAS 相关知识库与操作指南，无需用户再次说明问题域；' +
      '需要补充信息时只问关键项（如设备编号、IP、报错现象、日志）。',
    retrievalTerms: ['udas'],
  },
  {
    id: 'moz',
    aliases: [],
    label: 'Moz 问题定位',
    instruction:
      '本会话用户已通过菜单选择「Moz 问题定位」模式。后续消息默认都在描述 Moz 相关问题，' +
      '请直接按 Moz 故障定位思路分析，优先使用 Moz 相关知识库与操作指南，无需用户再次说明问题域；' +
      '需要补充信息时只问关键项（如设备编号、IP、报错现象、日志）。',
    retrievalTerms: ['moz'],
  },
  {
    id: 'equip',
    aliases: ['fixture'],
    label: '测试工装问题定位',
    instruction:
      '本会话用户已通过菜单选择「测试工装问题定位」模式。后续消息默认都在描述测试工装相关问题，' +
      '请直接按测试工装故障定位思路分析，优先使用工装相关知识库与操作指南，无需用户再次说明问题域；' +
      '需要补充信息时只问关键项（如工装编号、工位、报错现象、日志）。',
    retrievalTerms: ['equip', 'fixture', '工装'],
  },
];

/** Resolve a `/mode` argument to a mode definition (id or alias). */
export function resolveScopeMode(input: string): ScopeModeDef | undefined {
  const token = input.trim().toLowerCase();
  if (!token) return undefined;
  return SCOPE_MODES.find((m) => m.id === token || m.aliases.includes(token));
}

/**
 * In-memory per-scope mode selection. One instance per channel; cleared
 * implicitly on bridge restart and explicitly by session resets (`/new`,
 * `/cd`) in the command layer.
 */
export class ScopeModeStore {
  private data = new Map<string, ScopeModeDef>();

  /** Active mode definition for a scope, or undefined when none is set. */
  get(scope: string): ScopeModeDef | undefined {
    return this.data.get(scope);
  }

  set(scope: string, mode: ScopeModeDef): void {
    this.data.set(scope, mode);
    log.info('scope-mode', 'set', { scope, mode: mode.id });
  }

  /** Remove the mode for a scope (session reset). Returns true if removed. */
  clear(scope: string): boolean {
    const removed = this.data.delete(scope);
    if (removed) log.info('scope-mode', 'cleared', { scope });
    return removed;
  }
}
