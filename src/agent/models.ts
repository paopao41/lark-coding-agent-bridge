import type { AgentKind } from '../config/profile-schema';

/**
 * Sentinel selection meaning "don't pass `--model`; let the agent CLI /
 * account decide". Kept as a real option value (rather than empty string)
 * because Feishu's `select_static` requires `initial_option` to match one of
 * the option `value`s exactly and rejects an empty string.
 */
export const DEFAULT_MODEL = 'default';

export interface ModelOption {
  /**
   * Stored in `preferences.model` and forwarded to the agent's `--model`
   * flag. `DEFAULT_MODEL` is special-cased to omit the flag entirely.
   */
  value: string;
  /** Human-facing label shown in the `/config` picker. */
  label: string;
}

/**
 * Claude Code models. Pinned to concrete version ids (Claude Code's `--model`
 * accepts the full model-id string, not just the `opus`/`sonnet` aliases) so
 * the picker names an exact model. Add new ids here when a generation ships.
 */
const CLAUDE_MODELS: ModelOption[] = [
  { value: DEFAULT_MODEL, label: '跟随默认（不指定）' },
  { value: 'global.anthropic.claude-fable-5', label: 'Claude Fable 5' },
  { value: 'global.anthropic.claude-opus-4-8', label: 'Claude Opus 4.8' },
  { value: 'global.anthropic.claude-opus-4-7', label: 'Claude Opus 4.7' },
  { value: 'global.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'global.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6' },
  { value: 'global.anthropic.claude-opus-4-5-20251101-v1:0', label: 'Claude Opus 4.5' },
  { value: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5' },
  { value: 'global.anthropic.claude-sonnet-5', label: 'Claude Sonnet 5' },
  { value: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
  { value: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4' },
  { value: 'us.anthropic.claude-opus-4-1-20250805-v1:0', label: 'Claude Opus 4.1' },
  { value: 'global.anthropic.claude-opus-5', label: 'Claude Opus 5' },
];

/** Codex CLI models. Forwarded to `codex exec --model`. */
const CODEX_MODELS: ModelOption[] = [
  { value: DEFAULT_MODEL, label: '跟随默认（不指定）' },
  { value: 'gpt-5-codex', label: 'GPT-5 Codex' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'o3', label: 'o3' },
];

export interface ModelRoutingDecision {
  /** Concrete model passed to the adapter, or undefined to omit `--model`. */
  model?: string;
  /** Stored selection after validation, retained for diagnostics. */
  normalizedSelection: string;
  /** Why the decision was chosen, suitable for structured observability. */
  reason: 'profile-explicit' | 'profile-default' | 'profile-invalid';
}

/** The model picker options for a profile's agent kind. */
export function supportedModels(agentKind: AgentKind): ModelOption[] {
  return agentKind === 'codex' ? CODEX_MODELS : CLAUDE_MODELS;
}

/** True when the selection means "use the agent default" (no `--model`). */
export function isDefaultModel(value: string | undefined): boolean {
  return !value || value === DEFAULT_MODEL;
}

/**
 * Coerce a stored model preference into a value guaranteed to be one of the
 * current agent's picker options — Feishu's `select_static` requires
 * `initial_option` to match an option value exactly. Unknown / cross-agent
 * values (e.g. a Claude alias left over after switching a profile to Codex)
 * fall back to {@link DEFAULT_MODEL}.
 */
export function normalizeModelSelection(
  agentKind: AgentKind,
  value: string | undefined,
): string {
  if (isDefaultModel(value)) return DEFAULT_MODEL;
  return supportedModels(agentKind).some((model) => model.value === value)
    ? (value as string)
    : DEFAULT_MODEL;
}

/**
 * Resolve a request model deterministically. A valid explicit profile setting
 * always wins. Unset/default and invalid selections deliberately omit the flag
 * so the locally authenticated CLI/account chooses its compatible default.
 */
export function routeModelSelection(
  agentKind: AgentKind,
  value: string | undefined,
): ModelRoutingDecision {
  const normalizedSelection = normalizeModelSelection(agentKind, value);
  if (normalizedSelection !== DEFAULT_MODEL) {
    return {
      model: normalizedSelection,
      normalizedSelection,
      reason: 'profile-explicit',
    };
  }
  return {
    normalizedSelection,
    reason: isDefaultModel(value) ? 'profile-default' : 'profile-invalid',
  };
}

/**
 * Resolve the concrete model string to hand the agent, or `undefined` to omit
 * the `--model` flag. Cross-agent / unknown values are treated as "default".
 */
export function resolveModelArg(
  agentKind: AgentKind,
  value: string | undefined,
): string | undefined {
  return routeModelSelection(agentKind, value).model;
}

/** Picker label for a stored value, for display in the saved-config card. */
export function modelLabel(agentKind: AgentKind, value: string | undefined): string {
  const normalized = normalizeModelSelection(agentKind, value);
  return supportedModels(agentKind).find((model) => model.value === normalized)?.label ?? normalized;
}
