## ADDED Requirements

### Requirement: Skills loading in CustomizeContext

The `loadCustomizeContext` function SHALL also load skills from `<customizeDir>/skills/*.md` and include them in `CustomizeContext.skills` as a `SkillDocument[]`. The `skills` field SHALL always be present (empty array when no skills loaded), unlike `persona` which is optional.

#### Scenario: skills loaded alongside persona

- **WHEN** both `customize/SOUL.md` and `customize/skills/device-ssh.md` exist
- **THEN** `CustomizeContext` has `persona: PersonaContent` and `skills: [SkillDocument]` both populated

#### Scenario: skills loaded without persona

- **WHEN** `customize/SOUL.md` is absent but `customize/skills/device-ssh.md` exists
- **THEN** `CustomizeContext` has `persona: undefined` and `skills: [SkillDocument]` populated

#### Scenario: customize disabled skips skills too

- **WHEN** `profileConfig.customize.enabled === false`
- **THEN** `CustomizeContext.skills` is `[]` (same as persona being undefined — loader skips entire customize dir)

#### Scenario: skill file read failure

- **WHEN** one skill file in `skills/` directory cannot be read (permission denied, I/O error)
- **THEN** the loader logs a warning for that file, skips it, and continues loading other skill files; `CustomizeContext.skills` contains the successfully loaded skills only

### Requirement: SkillDocument type

The `SkillDocument` type SHALL have shape `{ name: string; description?: string; whenToUse?: string; content: string; charCount: number; sourceFile: string }`. The `sourceFile` is the absolute path to the skill file, for use in `/config` panel display.

#### Scenario: full SkillDocument

- **WHEN** `device-ssh.md` with frontmatter `name: device-ssh, description: 设备接入, whenToUse: 报障时` and body `[content]` is loaded
- **THEN** the `SkillDocument` has all six fields populated correctly, `charCount` equals the character count of `content`, `sourceFile` is the absolute path

#### Scenario: minimal SkillDocument

- **WHEN** `notes.md` without frontmatter is loaded
- **THEN** the `SkillDocument` has `name: "notes"`, `description: undefined`, `whenToUse: undefined`, `content: <file content>`, `charCount: <count>`, `sourceFile: <absolute path>`
