## ADDED Requirements

### Requirement: Knowledge loading in CustomizeContext

The `loadCustomizeContext` function SHALL also load knowledge from `<customizeDir>/knowledge/*.md` and include them in `CustomizeContext.knowledge` as a `KnowledgeDocument[]`. The `knowledge` field SHALL always be present (empty array when no knowledge loaded).

#### Scenario: knowledge loaded alongside persona and skills

- **WHEN** `customize/SOUL.md`, `customize/skills/device-ssh.md`, and `customize/knowledge/fault-dictionary.md` all exist
- **THEN** `CustomizeContext` has `persona`, `skills`, and `knowledge` all populated

#### Scenario: knowledge loaded without skills

- **WHEN** `customize/SOUL.md` is absent, `customize/skills/` is absent, but `customize/knowledge/fault-dictionary.md` exists
- **THEN** `CustomizeContext` has `persona: undefined`, `skills: []`, `knowledge: [KnowledgeDocument]`

#### Scenario: customize disabled skips knowledge too

- **WHEN** `profileConfig.customize.enabled === false`
- **THEN** `CustomizeContext.knowledge` is `[]` (same as persona/skills being empty — loader skips entire customize dir)

#### Scenario: knowledge file read failure

- **WHEN** one knowledge file in `knowledge/` directory cannot be read (permission denied, I/O error)
- **THEN** the loader logs a warning for that file, skips it, and continues loading other knowledge files; `CustomizeContext.knowledge` contains the successfully loaded documents only

### Requirement: KnowledgeDocument type

The `KnowledgeDocument` type SHALL have shape `{ name: string; description?: string; content: string; charCount: number; sourceFile: string }`. The type does NOT have a `whenToUse` field (knowledge is reference material, not invoked).

#### Scenario: full KnowledgeDocument

- **WHEN** `fault-dictionary.md` with frontmatter `name: fault-dictionary, description: 故障判读字典` and body `[content]` is loaded
- **THEN** the `KnowledgeDocument` has all five fields populated correctly, `charCount` equals the character count of `content`, `sourceFile` is the absolute path

#### Scenario: minimal KnowledgeDocument

- **WHEN** `notes.md` without frontmatter is loaded
- **THEN** the `KnowledgeDocument` has `name: "notes"`, `description: undefined`, `content: <file content>`, `charCount: <count>`, `sourceFile: <absolute path>`

### Requirement: Full CustomizeContext shape

The `CustomizeContext` SHALL have shape `{ persona?: PersonaContent; skills: SkillDocument[]; knowledge: KnowledgeDocument[] }`. The `persona` field is optional (undefined when SOUL.md absent); `skills` and `knowledge` fields are always arrays (possibly empty).

#### Scenario: all three populated

- **WHEN** SOUL.md, skills/, knowledge/ all exist
- **THEN** `CustomizeContext = { persona: PersonaContent, skills: [...], knowledge: [...] }`

#### Scenario: only persona

- **WHEN** only SOUL.md exists (no skills/ or knowledge/ dirs)
- **THEN** `CustomizeContext = { persona: PersonaContent, skills: [], knowledge: [] }`

#### Scenario: completely empty customize dir

- **WHEN** the customize dir exists but contains no SOUL.md, no skills/, no knowledge/
- **THEN** `CustomizeContext = { persona: undefined, skills: [], knowledge: [] }`
