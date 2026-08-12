## ADDED Requirements

### Requirement: Persona appended to bridge system prompt

The system SHALL append the SOUL.md content as a `<persona>` XML block after `BRIDGE_SYSTEM_PROMPT` when `customize.persona` is loaded. The `BRIDGE_SYSTEM_PROMPT` content MUST appear verbatim and unchanged before the `<persona>` block.

#### Scenario: SOUL.md present and readable

- **WHEN** `customize.persona` is loaded (SOUL.md exists, is readable, and is non-empty)
- **THEN** the system prompt passed to the agent ends with:

  ```
  <persona>
  [SOUL.md content verbatim]
  </persona>
  ```

#### Scenario: SOUL.md absent

- **WHEN** `customize.persona` is `undefined` (file missing, empty, or unreadable)
- **THEN** the system prompt is identical to current `BRIDGE_SYSTEM_PROMPT` content — no `<persona>` block appended

#### Scenario: BRIDGE_SYSTEM_PROMPT preserved

- **WHEN** persona is injected
- **THEN** the existing `BRIDGE_SYSTEM_PROMPT` constant content appears verbatim, in its original order, before the `<persona>` block

### Requirement: SOUL.md file format handling

The loader SHALL read SOUL.md as UTF-8 text. If the file starts with a UTF-8 BOM (0xEF 0xBB 0xBF), the BOM MUST be stripped before injection. Internal whitespace, blank lines, and markdown structure MUST be preserved verbatim.

#### Scenario: BOM-prefixed file

- **WHEN** SOUL.md starts with the UTF-8 BOM byte sequence
- **THEN** the BOM is stripped and the remaining content is injected

#### Scenario: empty file

- **WHEN** SOUL.md exists but is empty (0 bytes)
- **THEN** `customize.persona` is `undefined` (treated as "no persona"), no `<persona>` block is appended

#### Scenario: whitespace-only file

- **WHEN** SOUL.md contains only whitespace characters
- **THEN** `customize.persona.content` is the trimmed empty string, but `<persona>` block is NOT injected (treated as "no persona")

### Requirement: Persona is profile-scoped

Persona injection SHALL apply at profile level — the same SOUL.md is used for all chats, sessions, and threads under the same profile. Persona does not vary per chat or per user.

#### Scenario: same persona across chats

- **WHEN** two different chats under the same profile invoke the agent in close succession
- **THEN** both runs read SOUL.md fresh from disk and receive the same `<persona>` block

#### Scenario: different profiles different personas

- **WHEN** profile A has `customize/SOUL.md` defining "华佗诊断机器人" and profile B has `customize/SOUL.md` defining "通用编程助手"
- **THEN** runs under profile A receive 华佗 persona, runs under profile B receive 编程助手 persona, with no cross-contamination

### Requirement: Config card persona status display

The `/config` form card SHALL include a "人格定制" collapsible panel showing:

- Whether customize is enabled (toggle)
- SOUL.md path (resolved absolute path or "(未创建)" if absent)
- SOUL.md character count (or "(未加载)" if not loaded)
- Last loaded content preview (first 200 characters, truncated with "…")

#### Scenario: SOUL.md loaded

- **WHEN** user opens `/config` and SOUL.md is loaded
- **THEN** the panel shows: enabled=true, absolute path, character count, first 200 chars preview

#### Scenario: SOUL.md not created

- **WHEN** user opens `/config` and `customize/SOUL.md` does not exist
- **THEN** the panel shows: enabled=true, path field shows "(未创建)", character count shows "(未加载)", preview shows "_创建 SOUL.md 以激活人格注入_"
