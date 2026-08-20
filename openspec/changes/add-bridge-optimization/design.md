## Context

This change updates the bridge from a full-injection, exploration-heavy execution path to a more selective execution path. The bridge already has stable seams for customization loading, prompt assembly, model selection, run orchestration, session persistence, and command dispatch. The current work should preserve those seams while adding task planning, selective retrieval, model routing, and bridge-owned prompt/history budgets.

## Goals / Non-Goals

**Goals:**
- Add explicit high-level workflow selection for common tasks.
- Reduce repeated browse/read loops by classifying tool need and bounding repeat exploration.
- Switch knowledge delivery from unconditional full injection to selected, bounded retrieval.
- Add task-aware model routing while preserving explicit profile choices.
- Add bridge-side context/history budgets and split rendered knowledge into bounded blocks.
- Keep current profiles working during migration, including a compatibility fallback for full knowledge injection.

**Non-Goals:**
- Replace the Claude/Codex CLI transports with a new SDK in this change.
- Introduce embeddings or a vector database in the first implementation.
- Rewrite native Claude/Codex session history files.
- Remove existing command handlers or profile-level customization loading.

## Decisions

### 1) Keep customization loading, but add a selection layer above it
`src/customize/loader.ts` remains the entry point for persona/skills/knowledge loading. The change adds metadata and retrieval helpers above that layer so the system can select which documents or chunks to render without changing profile discovery or directory resolution semantics.

### 2) Preserve prompt assembly as the final rendering stage
`src/agent/bridge-system-prompt.ts` continues to render the final system prompt, but it should consume already-selected persona/skill/knowledge blocks rather than being responsible for discovery. This keeps rendering deterministic and preserves existing escaping and ordering rules.

### 3) Make task planning explicit and deterministic first
Task classification and tool-need detection should start with deterministic heuristics derived from request text, attachments, and known workflow metadata. That keeps the initial implementation cheap and auditable. If a later change adds model-assisted classification, it can reuse the same output shape without changing the rest of the pipeline.

### 4) Route models without overriding explicit user intent
`src/agent/models.ts` remains the source of valid model catalogs and normalization. A new routing layer may choose among supported models only when no explicit profile selection already determines the answer. Explicit profile selection stays highest priority.

### 5) Bound repeated exploration by state, not by hidden model behavior
The bridge should record which workflow/knowledge selections have already been made for a run and limit repeated reads/browses at the bridge layer where possible. The first implementation should avoid trying to police every downstream tool call; instead it should reduce the need for repetition by giving the agent enough structured context up front.

### 6) Treat history control as bridge-owned prompt policy, not session-file mutation
`src/session/store.ts` and `src/session/catalog.ts` should continue to persist resumable session identifiers. The new history policy should focus on what the bridge injects, how much recent context it preserves, and when it summarizes or trims bridge-owned state. Native CLI history files remain untouched.

### 7) Preserve a compatibility fallback
If retrieval or routing metadata is unavailable, the bridge should still be able to render the legacy full-injection style prompt so existing profiles keep working during rollout.

## Risks / Trade-offs

- **More metadata to maintain:** skills and knowledge need stable identifiers and summaries. This is more work up front, but it enables selection and observability later.
- **Potential prompt drift during migration:** keeping a compatibility fallback avoids breakage, but some profiles may temporarily run in the old and new styles until the migration is complete.
- **Heuristic routing errors:** deterministic routing is easy to audit, but imperfect. Logs and test coverage are important so wrong decisions can be corrected quickly.
- **History policy must not lose evidence:** trimming or summarizing too aggressively could remove useful diagnostics. The first implementation should err on preserving recent evidence and only compact older context.
