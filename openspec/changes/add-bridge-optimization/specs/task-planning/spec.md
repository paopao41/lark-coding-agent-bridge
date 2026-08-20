## Purpose
This capability ensures common HWATO requests can be routed into explicit, reusable high-level workflows instead of relying on free-form exploration. The bridge should recognize fixed procedures, select the right workflow, and keep the agent within the prescribed steps unless the workflow explicitly allows escalation.

## ADDED Requirements

### Requirement: High-level workflow skills are selectable by request
The system MUST expose reusable workflow skills for common diagnostic and documentation tasks, and each workflow skill MUST describe its purpose, prerequisites, required evidence, and failure fallback.

#### Scenario: Request matches a known workflow
- **WHEN** a user request matches a known high-level workflow
- **THEN** the system selects the corresponding workflow skill instead of treating the request as open-ended exploration

#### Scenario: Workflow is not applicable
- **WHEN** a user request does not match any known workflow skill
- **THEN** the system falls back to ordinary task handling

### Requirement: Workflow skills constrain repeated exploration
Workflow skills MUST state when the agent may stop, when it must avoid repeated directory browsing or repeated file reads, and when it should escalate to a fallback path.

#### Scenario: Workflow includes a bounded procedure
- **WHEN** a selected workflow is executed
- **THEN** the agent follows the workflow steps without repeatedly re-reading the same guidance unless the workflow explicitly requires it

#### Scenario: Workflow reaches a stop condition
- **WHEN** the workflow reaches a documented stop condition
- **THEN** the system reports the stop condition rather than continuing to probe for unrelated evidence
