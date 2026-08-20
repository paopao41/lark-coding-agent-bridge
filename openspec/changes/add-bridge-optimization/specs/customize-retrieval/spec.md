## Purpose
The bridge should choose relevant customization content on demand rather than injecting all knowledge blocks into every run. This capability defines how metadata, chunking, and compatibility fallback behave so the system remains predictable as knowledge grows.

## ADDED Requirements

### Requirement: Knowledge content is selected on demand
The system MUST select knowledge content based on request relevance instead of injecting every knowledge document into the prompt for every run.

#### Scenario: Request only needs a subset of knowledge
- **WHEN** a request can be answered using a small subset of knowledge documents
- **THEN** the system injects only the relevant selected documents or chunks

#### Scenario: Request has no relevant knowledge match
- **WHEN** no knowledge document is relevant enough for selection
- **THEN** the system falls back to the compatibility behavior configured for the profile

### Requirement: Knowledge documents expose retrieval metadata
Each knowledge document MUST have metadata sufficient for selection, including a stable identity, descriptive text, and a path or grouping reference.

#### Scenario: Knowledge document is indexed
- **WHEN** the customize loader reads a knowledge document
- **THEN** the document is available through retrieval metadata without requiring the full body to be re-parsed for selection

### Requirement: Knowledge blocks are split into bounded units
The system MUST support rendering knowledge as bounded blocks instead of a single monolithic block.

#### Scenario: A knowledge document is long
- **WHEN** a knowledge document exceeds the system’s rendering chunk boundary
- **THEN** the document is split into multiple renderable blocks while preserving stable ordering

### Requirement: Legacy full knowledge injection remains compatible
The system MUST preserve a compatibility path that can still render the previous full knowledge block behavior when retrieval is unavailable or disabled.

#### Scenario: Retrieval is disabled
- **WHEN** the retrieval layer is unavailable or explicitly disabled
- **THEN** the system still produces a valid prompt using the compatibility path
