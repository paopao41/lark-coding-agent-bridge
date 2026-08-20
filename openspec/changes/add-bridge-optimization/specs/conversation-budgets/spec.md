## Purpose
The bridge should distinguish between requests that need tools and requests that can be answered without a full execution loop. This capability defines how the system decides whether to enter tool-driven execution, and how that decision affects routing and workflow selection.

## ADDED Requirements

### Requirement: Tool need is classified before full execution
The system MUST classify whether a request needs tools before entering the full agent execution flow.

#### Scenario: Pure information request
- **WHEN** the request can be answered without tools
- **THEN** the system does not require a tool-driven execution path

#### Scenario: Diagnostic request
- **WHEN** the request requires file access, command execution, or live system state
- **THEN** the system marks the request as needing tools

### Requirement: Tool need classification can select workflow guidance
The system MUST be able to reuse the tool-need result to select an appropriate high-level workflow or fallback path.

#### Scenario: Known diagnostic workflow
- **WHEN** the tool-need classifier recognizes a known diagnostic workflow
- **THEN** the workflow guidance is attached to the request before execution

### Requirement: Tool need classification does not bypass authorization
The system MUST NOT use tool-need classification as authorization.

#### Scenario: Request needs tools but is not permitted
- **WHEN** a request needs tools but fails access or policy checks
- **THEN** the system rejects the run using the existing policy path
