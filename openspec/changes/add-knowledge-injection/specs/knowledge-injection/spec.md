## ADDED Requirements

### Requirement: Knowledge directory scanning

The system SHALL scan `<customizeDir>/knowledge/*.md` (non-recursive) and load each file as a `KnowledgeDocument`. Files without `.md` extension SHALL be ignored. Subdirectories under `knowledge/` SHALL NOT be scanned.

#### Scenario: knowledge directory absent

- **WHEN** the `knowledge/` directory does not exist under the customize dir
- **THEN** the loader returns `knowledge: []` (empty array) without logging an error

#### Scenario: knowledge directory with markdown files

- **WHEN** the `knowledge/` directory contains `fault-dictionary.md`, `sn-port-mapping.md`, `can-bus-manual.md`
- **THEN** the loader returns three `KnowledgeDocument` entries, ordered by filename lexicographic ascending

#### Scenario: non-markdown files ignored

- **WHEN** the `knowledge/` directory contains `notes.txt`, `README.md`, `fault-dictionary.md`
- **THEN** the loader loads only `README.md` and `fault-dictionary.md`; `notes.txt` is ignored

#### Scenario: subdirectories ignored

- **WHEN** the `knowledge/` directory contains a subdirectory `archive/old-dictionary.md`
- **THEN** the loader does not scan into `archive/`; only top-level `.md` files are loaded

### Requirement: YAML frontmatter parsing for knowledge

Each knowledge file MAY start with a YAML frontmatter block delimited by `---` lines. The loader SHALL extract `name` and `description` fields if present. The `whenToUse` field SHALL NOT be used for knowledge (ignored even if present). The frontmatter block MUST be stripped from the injected content.

#### Scenario: frontmatter present with all fields

- **WHEN** a knowledge file starts with:
  ```
  ---
  name: fault-dictionary
  description: USB 相机故障判读字典
  ---
  [knowledge body]
  ```
- **THEN** the loader returns `KnowledgeDocument { name: "fault-dictionary", description: "USB 相机故障判读字典", content: "[knowledge body]", ... }`

#### Scenario: no frontmatter

- **WHEN** a knowledge file has no `---` delimiter at the start
- **THEN** the loader returns `KnowledgeDocument { name: <filename stem>, description: undefined, content: <entire file content>, ... }`

#### Scenario: whenToUse field ignored

- **WHEN** a knowledge file frontmatter contains `whenToUse: 报障时`
- **THEN** the loader ignores the `whenToUse` field; `KnowledgeDocument` does not have a `whenToUse` property

#### Scenario: malformed frontmatter

- **WHEN** the file starts with `---` but the content between delimiters is not valid YAML
- **THEN** the loader treats the entire file (including `---` lines) as content with `name` = filename stem; no error is thrown

### Requirement: Knowledge injection into system prompt

The system SHALL inject a `<knowledge_base>` XML block after the `<skills>` block when building the bridge system prompt. The block SHALL always be present (even when `knowledge` is empty).

#### Scenario: knowledge present

- **WHEN** `customize.knowledge` contains two documents with names `fault-dictionary` and `sn-port-mapping`
- **THEN** the system prompt contains:
  ```
  <knowledge_base>
  <knowledge name="fault-dictionary">[content]</knowledge>
  <knowledge name="sn-port-mapping">[content]</knowledge>
  </knowledge_base>
  ```

#### Scenario: knowledge empty

- **WHEN** `customize.knowledge` is an empty array
- **THEN** the system prompt contains `<knowledge_base></knowledge_base>` (empty block, but present)

#### Scenario: knowledge present but skills absent

- **WHEN** `customize.knowledge` is non-empty and `customize.skills` is empty
- **THEN** the system prompt has `<knowledge_base>` block immediately after the empty `<skills></skills>` block

### Requirement: Knowledge content integrity

The loader SHALL read knowledge files as UTF-8 text, strip UTF-8 BOM if present, and preserve internal whitespace and markdown structure verbatim. The content field MUST NOT include the frontmatter block.

#### Scenario: BOM-prefixed knowledge file

- **WHEN** a knowledge file starts with UTF-8 BOM
- **THEN** the BOM is stripped before parsing frontmatter and content

#### Scenario: markdown structure preserved

- **WHEN** a knowledge file contains markdown tables, code blocks, and lists
- **THEN** the `content` field preserves all markdown syntax verbatim (no rendering, no transformation)

### Requirement: Config card knowledge panel

The `/config` form card SHALL include a "知识库" collapsible panel below the "技能清单" panel. The panel SHALL list each loaded knowledge file with its name, description (if any), and character count. When no knowledge is loaded, the panel shows "_创建 customize/knowledge/*.md 以激活知识库注入_". The panel SHALL also display the total character count of all loaded knowledge.

#### Scenario: knowledge loaded

- **WHEN** user opens `/config` and two knowledge files are loaded
- **THEN** the panel lists: `- fault-dictionary (USB 相机故障判读字典, 2345 字符)` / `- sn-port-mapping (1234 字符)`, plus a footer `总计: 3579 字符`

#### Scenario: no knowledge loaded

- **WHEN** user opens `/config` and `customize.knowledge` is empty
- **THEN** the panel shows: "_创建 customize/knowledge/*.md 以激活知识库注入_" with no total count footer
