## Purpose
The bridge should pick an execution model that matches the request instead of always relying on a single stored preference. This capability defines how explicit user/profile choices, task characteristics, and agent compatibility interact.

## ADDED Requirements

### Requirement: Explicit model selection takes priority
The system MUST honor an explicit profile model selection ahead of any automatic routing decision.

#### Scenario: User pins a model
- **WHEN** the profile specifies a concrete supported model
- **THEN** the bridge uses that model unless the selection is invalid for the active agent kind

#### Scenario: Invalid model for agent kind
- **WHEN** the profile model is not supported by the active agent kind
- **THEN** the bridge falls back to the agent default selection behavior

### Requirement: Automatic routing is based on task characteristics
If explicit model selection does not fully determine the result, the system MUST be able to choose a model from task characteristics such as complexity, tool use, and workflow type.

#### Scenario: Simple request
- **WHEN** the request is low complexity and does not require tools
- **THEN** the system may route to a lighter model choice

#### Scenario: Complex diagnostic request
- **WHEN** the request is complex or requires multiple tools
- **THEN** the system may route to a stronger model choice

### Requirement: Routing decisions are observable
The system MUST record the reason for a routing decision in logs or execution metadata.

#### Scenario: Route is selected
- **WHEN** the bridge chooses a model
- **THEN** the decision includes a machine-readable or human-readable reason
