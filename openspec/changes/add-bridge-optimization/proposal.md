# Proposal: Optimize bridge task execution and context delivery

## Why

The bridge currently sends every request through the full agent workflow while loading customization documents eagerly and rendering knowledge as one large prompt block. Logs show that local customization loading is fast, but agent startup, repeated exploratory tool calls, and long context execution create high first-response latency and long-tail runs. The bridge needs explicit task planning so common workflows are deterministic, only relevant knowledge is loaded, and model/session resources are matched to the request.

## What Changes

- Add high-level, reusable workflow skills for common HWATO tasks, with explicit inputs, procedures, evidence requirements, stop conditions, and failure fallbacks.
- Add deterministic task/tool-need classification before full execution so simple responses can avoid unnecessary tool loops and known workflows can be selected directly.
- Add bounded retrieval state and execution guidance to reduce duplicate reads, directory browsing, and repeated attempts within one run.
- Replace unconditional full knowledge injection with metadata-first, query-aware retrieval and bounded knowledge chunks, while preserving a compatibility fallback for existing profiles.
- Split rendered customization into stable persona/catalog content and selected skill/knowledge blocks rather than one monolithic knowledge block.
- Add optional task-aware model routing while preserving explicit profile model selections as the highest-priority choice and keeping agent-specific model validation.
- Add bridge-owned conversation limits and compaction metadata for injected prompt context and resumable sessions without rewriting native Claude/Codex history files.
- Add tests, logging, and telemetry fields for selection decisions, context budgets, tool-need decisions, route reasons, and history limits.

## Capabilities

### New Capabilities

- `task-planning`: classify requests, determine tool requirements, select high-level skills, and bound repeated exploration.
- `customize-retrieval`: index customization metadata, retrieve relevant documents/chunks on demand, and render split context blocks.
- `model-routing`: select an agent model from task characteristics while honoring explicit profile configuration.
- `conversation-budgets`: enforce bridge-side prompt/history budgets and preserve safe native session resumption.

### Modified Capabilities

- `customize-injection`: change customization loading and prompt assembly from unconditional full knowledge injection to compatibility-aware, selected-block injection.

## Impact

- Primary code: `src/customize/*`, `src/agent/bridge-system-prompt.ts`, `src/agent/prompt.ts`, `src/agent/types.ts`, `src/bot/channel.ts`, `src/bot/run-flow.ts`, `src/agent/models.ts`, `src/session/*`, and profile configuration normalization.
- Content: `hwato-customize/skills/*` and selected `hwato-customize/knowledge/*` files will gain structured metadata and explicit workflows.
- Existing local changes in `src/agent/models.ts`, `src/bot/channel.ts`, `src/bot/comments.ts`, `src/bot/reaction.ts`, and `src/config/profile-store.ts` must be preserved and extended with focused patches.
- No new runtime dependency is required for the first implementation; retrieval starts with deterministic lexical/path/tag matching and bounded Markdown chunking.
- Native Claude session IDs and Codex thread IDs remain authoritative. The bridge will not mutate CLI-owned history files directly.
- Existing profiles must continue to work when no retrieval configuration is present; the legacy full-injection path remains available as a compatibility fallback during migration.
