## ADDED Requirements

### Requirement: Skills directory scanning

The system SHALL scan `<customizeDir>/skills/*.md` (non-recursive) and load each file as a `SkillDocument`. Files without `.md` extension SHALL be ignored. Subdirectories under `skills/` SHALL NOT be scanned.

#### Scenario: skills directory absent

- **WHEN** the `skills/` directory does not exist under the customize dir
- **THEN** the loader returns `skills: []` (empty array) without logging an error

#### Scenario: skills directory with markdown files

- **WHEN** the `skills/` directory contains `device-ssh.md`, `camera-doctor.md`, `feishu-docs.md`
- **THEN** the loader returns three `SkillDocument` entries, ordered by filename lexicographic ascending

#### Scenario: non-markdown files ignored

- **WHEN** the `skills/` directory contains `notes.txt`, `README.md`, `device-ssh.md`
- **THEN** the loader loads only `README.md` and `device-ssh.md`; `notes.txt` is ignored

#### Scenario: subdirectories ignored

- **WHEN** the `skills/` directory contains a subdirectory `archive/old-skill.md`
- **THEN** the loader does not scan into `archive/`; only top-level `.md` files are loaded

### Requirement: YAML frontmatter parsing

Each skill file MAY start with a YAML frontmatter block delimited by `---` lines. The loader SHALL extract `name`, `description`, `whenToUse` fields if present. The frontmatter block MUST be stripped from the injected content.

#### Scenario: frontmatter present with all fields

- **WHEN** a skill file starts with:
  ```
  ---
  name: device-ssh
  description: 设备免密接入
  whenToUse: 接到报障需要 SSH 时
  ---
  [skill body]
  ```
- **THEN** the loader returns `SkillDocument { name: "device-ssh", description: "设备免密接入", whenToUse: "接到报障需要 SSH 时", content: "[skill body]" }`

#### Scenario: no frontmatter

- **WHEN** a skill file has no `---` delimiter at the start
- **THEN** the loader returns `SkillDocument { name: <filename stem>, description: undefined, whenToUse: undefined, content: <entire file content> }`

#### Scenario: frontmatter with missing optional fields

- **WHEN** a skill file has frontmatter with only `name: device-ssh`
- **THEN** the loader returns `SkillDocument { name: "device-ssh", description: undefined, whenToUse: undefined, content: <body> }`

#### Scenario: frontmatter with empty name field

- **WHEN** frontmatter has `name: ` (empty value) or `name:` line with no value
- **THEN** the loader falls back to using the filename stem as `name`

#### Scenario: malformed frontmatter YAML

- **WHEN** the file starts with `---` but the content between delimiters is not valid YAML (e.g., unparseable syntax)
- **THEN** the loader treats the entire file (including the `---` lines) as content with `name` = filename stem; no error is thrown

### Requirement: Skills injection into system prompt

The system SHALL inject a `<skills>` XML block after the `<persona>` block (or after `BRIDGE_SYSTEM_PROMPT` if no persona) when building the bridge system prompt. The block SHALL always be present (even when `skills` is empty).

#### Scenario: skills present

- **WHEN** `customize.skills` contains three documents with names `device-ssh`, `camera-doctor`, `feishu-docs`
- **THEN** the system prompt contains:
  ```
  <skills>
  <skill name="device-ssh">[content of device-ssh.md]</skill>
  <skill name="camera-doctor">[content of camera-doctor.md]</skill>
  <skill name="feishu-docs">[content of feishu-docs.md]</skill>
  </skills>
  ```

#### Scenario: skills empty

- **WHEN** `customize.skills` is an empty array
- **THEN** the system prompt contains `<skills></skills>` (empty block, but present)

#### Scenario: skills present but persona absent

- **WHEN** `customize.skills` is non-empty and `customize.persona` is undefined
- **THEN** the system prompt has `<skills>` block immediately after `BRIDGE_SYSTEM_PROMPT` content (no `<persona>` block in between)

### Requirement: Skill content integrity

The loader SHALL read skill files as UTF-8 text, strip UTF-8 BOM if present, and preserve internal whitespace and markdown structure verbatim. The content field of `SkillDocument` MUST NOT include the frontmatter block.

#### Scenario: BOM-prefixed skill file

- **WHEN** a skill file starts with UTF-8 BOM
- **THEN** the BOM is stripped before parsing frontmatter and content

#### Scenario: markdown structure preserved

- **WHEN** a skill file contains markdown headers, code blocks, and lists
- **THEN** the `content` field preserves all markdown syntax verbatim (no rendering, no transformation)

### Requirement: Config card skills panel

The `/config` form card SHALL include a "技能清单" collapsible panel below the "人格定制" panel. The panel SHALL list each loaded skill with its name and character count. When no skills are loaded, the panel shows "_创建 customize/skills/*.md 以激活技能注入_".

#### Scenario: skills loaded

- **WHEN** user opens `/config` and three skills are loaded
- **THEN** the panel lists: `- device-ssh (1234 字符)` / `- camera-doctor (5678 字符)` / `- feishu-docs (901 字符)`

#### Scenario: no skills loaded

- **WHEN** user opens `/config` and `customize.skills` is empty
- **THEN** the panel shows: "_创建 customize/skills/*.md 以激活技能注入_"
