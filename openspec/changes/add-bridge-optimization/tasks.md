## 1. Core customization metadata

- [x] 1.1 Extend customize types with retrieval-friendly metadata for skills and knowledge while keeping legacy loaded content available
- [x] 1.2 Update customize loaders to preserve deterministic ordering and attach identifiers / summaries needed for selection
- [x] 1.3 Add unit tests for metadata loading, ordering, and compatibility fallback when no customize data exists

## 2. Workflow selection and tool-need classification

- [x] 2.1 Add deterministic request classification for common workflows and tool requirements
- [x] 2.2 Route known workflows before the generic exploration path in run-flow and channel intake
- [x] 2.3 Add tests covering simple requests, diagnostic requests, and policy rejection paths

## 3. Knowledge retrieval and prompt splitting

- [x] 3.1 Add bounded knowledge selection helpers for metadata-first retrieval and chunked rendering
- [x] 3.2 Update bridge system prompt assembly to render selected skills / knowledge blocks instead of one monolithic knowledge block
- [x] 3.3 Preserve a compatibility path that can still render the legacy full-injection prompt
- [x] 3.4 Add tests for selected block rendering, fallback behavior, and XML escaping / ordering

## 4. Model routing

- [ ] 4.1 Add task-aware routing logic that preserves explicit profile model selection as the highest priority
- [ ] 4.2 Thread routing reasons and selected model metadata through run-flow and channel observability
- [ ] 4.3 Add tests for supported-model validation, default fallback, and routing reason reporting

## 5. Conversation budgets and history control

- [ ] 5.1 Add bridge-side limits for injected prompt context and recent conversation state
- [ ] 5.2 Record summary / truncation metadata in session or catalog state without mutating native CLI history files
- [ ] 5.3 Add tests for bounded history behavior and safe session reuse

## 6. HWATO skill/content updates and validation

- [ ] 6.1 Refactor or add high-level workflow skill documents for common diagnostic flows
- [ ] 6.2 Split large knowledge documents into bounded blocks where needed and update references
- [ ] 6.3 Run the relevant unit and integration tests, then verify the OpenSpec change status is ready for apply
