/**
 * Customize layer types.
 *
 * The customize layer is a per-profile data volume that lets users extend
 * the bridge's system prompt without modifying source code. It has three
 * subdomains:
 *  - persona: identity / rules / response style (single SOUL.md file)
 *  - skills:  capability / operation guides (multiple *.md files)
 *  - knowledge: reference facts (multiple *.md files)
 *
 * The loader (`src/customize/loader.ts`) reads these from
 * `<profileDir>/customize/` (or a path override) and returns a
 * `CustomizeContext`. System prompt assembly (`buildBridgeSystemPrompt`)
 * consumes the context to inject `<persona>` / `<skills>` / `<knowledge_base>`
 * XML blocks after `BRIDGE_SYSTEM_PROMPT`.
 *
 * Design principles:
 *  - All file IO is best-effort: missing files / read failures downgrade to
 *    "not loaded" rather than throwing.
 *  - `skills` and `knowledge` fields are always arrays (possibly empty);
 *    `persona` is optional (undefined when SOUL.md absent).
 *  - Loading is per-run: no in-process caching. Editing files on disk
 *    between runs takes effect on the next run.
 */

/**
 * Raw persona content loaded from `customize/SOUL.md`.
 *
 * `content` is the file body verbatim (BOM stripped, internal whitespace
 * preserved). Empty / whitespace-only files yield `undefined` persona.
 */
export interface PersonaContent {
  /** SOUL.md content verbatim (BOM stripped, no transformation). */
  content: string;
  /** Character count of `content` (excludes stripped BOM). */
  charCount: number;
  /** First 200 characters of `content`, truncated with "…" if longer. */
  preview: string;
  /** Absolute path to the source SOUL.md file. */
  sourceFile: string;
}

/**
 * A skill document loaded from `customize/skills/*.md`.
 *
 * Skills are capability / operation guides. Each `.md` file becomes one
 * `SkillDocument` injected into the `<skills>` block of the system prompt.
 */
export interface SkillDocument {
  /** Skill name (from frontmatter `name:` field, or filename stem). */
  name: string;
  /** Optional human-readable description (frontmatter `description:`). */
  description?: string;
  /** Optional hint for when the agent should invoke this skill. */
  whenToUse?: string;
  /** File body verbatim (frontmatter stripped, BOM stripped). */
  content: string;
  /** Character count of `content`. */
  charCount: number;
  /** Absolute path to the source skill file. */
  sourceFile: string;
}

/**
 * A knowledge document loaded from `customize/knowledge/*.md`.
 *
 * Knowledge is reference facts (fault dictionaries, mapping tables, manuals)
 * distinct from skills (operation guides). Each `.md` file becomes one
 * `KnowledgeDocument` injected into the `<knowledge_base>` block.
 */
export interface KnowledgeDocument {
  /** Knowledge name (from frontmatter `name:` field, or filename stem). */
  name: string;
  /** Optional human-readable description (frontmatter `description:`). */
  description?: string;
  /** File body verbatim (frontmatter stripped, BOM stripped). */
  content: string;
  /** Character count of `content`. */
  charCount: number;
  /** Absolute path to the source knowledge file. */
  sourceFile: string;
}

/**
 * Loaded customize context for a profile.
 *
 * - `persona` is optional: undefined when SOUL.md is absent / empty.
 * - `skills` and `knowledge` are always arrays: empty when no files loaded.
 */
export interface CustomizeContext {
  /** Persona from SOUL.md. `undefined` when absent / empty / unreadable. */
  persona?: PersonaContent;
  /** Skill documents. Always an array (empty when no skill files loaded). */
  skills: SkillDocument[];
  /** Knowledge documents. Always an array (empty when no knowledge loaded). */
  knowledge: KnowledgeDocument[];
  /** Absolute path to the customize directory. Exported to agent
   *  subprocesses as `LARK_CHANNEL_CUSTOMIZE_DIR` so agent-side tools can
   *  locate skills / knowledge / memory files at runtime. */
  dir: string;
}

/**
 * Per-profile customize config (from `ProfileConfig.customize`).
 *
 * - `enabled: false` skips the entire customize layer (back-compat escape
 *   hatch for users who want legacy behavior).
 * - `dir` overrides the default `<profileDir>/customize/` location; must be
 *   an absolute path (relative paths are rejected by `normalizeCustomize`).
 */
export interface CustomizeConfig {
  enabled: boolean;
  dir?: string;
}

/**
 * Default customize config when the `customize` field is absent from a
 * profile. Customizing is ON by default (backward compatible because a
 * missing `customize/` directory is a no-op: returns empty context).
 */
export const DEFAULT_CUSTOMIZE_CONFIG: CustomizeConfig = {
  enabled: true,
};
