## ADDED Requirements

### Requirement: Customize context loading

The system SHALL load customize context from `<profileDir>/customize/` directory at agent run startup, returning a `CustomizeContext` object consumed by system prompt assembly. The loader MUST NOT throw on missing files or directories — it returns an empty context instead.

#### Scenario: customize directory absent

- **WHEN** the `customize/` directory does not exist under the resolved profile dir
- **THEN** the loader returns an empty `CustomizeContext` (no persona, no skills, no knowledge) without logging an error

#### Scenario: customize disabled by config

- **WHEN** `profileConfig.customize.enabled === false`
- **THEN** the loader skips reading the customize directory entirely and returns an empty `CustomizeContext`

#### Scenario: custom customize dir override

- **WHEN** `profileConfig.customize.dir` is set to an absolute path
- **THEN** the loader reads from that path instead of `<profileDir>/customize/`

#### Scenario: SOUL.md read failure

- **WHEN** `customize/SOUL.md` exists but cannot be read (permission denied, I/O error)
- **THEN** the loader logs a warning, returns `CustomizeContext` with `persona: undefined`, and does not throw

### Requirement: Profile config field for customize

The `ProfileConfig` schema SHALL include a `customize` field with shape `{ enabled: boolean; dir?: string }`. The `normalizeCustomize()` function SHALL default `enabled` to `true` and `dir` to `undefined` when the field is absent, preserving backward compatibility with existing profiles.

#### Scenario: legacy profile without customize field

- **WHEN** a profile config has no `customize` field
- **THEN** `normalizeProfileConfig` populates `customize: { enabled: true; dir: undefined }` and downstream behavior is identical to current implementation (no persona injection if SOUL.md absent)

#### Scenario: explicit disable

- **WHEN** profile config has `customize: { enabled: false }`
- **THEN** the loader skips customize loading entirely, regardless of whether `SOUL.md` exists on disk

### Requirement: Customize context propagation to subprocess env

The system SHALL inject `LARK_CHANNEL_CUSTOMIZE_DIR` environment variable into the agent subprocess when customize is enabled and the customize directory exists. The variable MUST NOT be set when customize is disabled or the directory does not exist.

#### Scenario: customize enabled and dir exists

- **WHEN** `customize.enabled === true` and the resolved customize directory exists on disk
- **THEN** the agent subprocess receives `LARK_CHANNEL_CUSTOMIZE_DIR` pointing to the resolved directory absolute path

#### Scenario: customize disabled

- **WHEN** `customize.enabled === false`
- **THEN** `LARK_CHANNEL_CUSTOMIZE_DIR` is not present in the subprocess environment

#### Scenario: customize enabled but dir absent

- **WHEN** `customize.enabled === true` but the customize directory does not exist on disk
- **THEN** `LARK_CHANNEL_CUSTOMIZE_DIR` is not set (avoids pointing agent at non-existent path)

### Requirement: Customize loading is per-run

The loader SHALL read customize files fresh from disk on every agent run. No in-process caching of file contents.

#### Scenario: SOUL.md edited mid-session

- **WHEN** SOUL.md is modified on disk after a run completes
- **THEN** the next agent run reads the updated content and injects the new persona
