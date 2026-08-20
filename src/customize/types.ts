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
export type CustomizeSourceKind = 'skill' | 'knowledge';

export type KnowledgeBlockKind = 'document' | 'chunk';


export interface CustomizeDocumentMetadata {
  /** Stable retrieval id, derived from the relative path unless overridden. */
  id: string;
  /** Path relative to the customize directory, using POSIX separators. */
  relativePath: string;
  /** Lowercase retrieval terms from id/path/frontmatter/headings. */
  searchText: string;
}

export interface KnowledgeBlock {
  id: string;
  documentId: string;
  name: string;
  kind: KnowledgeBlockKind;
  content: string;
  charCount: number;
  sourceFile: string;
  relativePath?: string;
  ordinal: number;
}

export interface CustomizeRetrievalTrace {
  query: string;
  selectedSkillIds: string[];
  selectedKnowledgeIds: string[];
  selectedBlockIds: string[];
  omittedKnowledgeIds: string[];
  totalChars: number;
  reason: string;
}

export interface CustomizeRetrievalResult {
  skills: SkillDocument[];
  knowledge: KnowledgeDocument[];
  blocks: KnowledgeBlock[];
  trace: CustomizeRetrievalTrace;
}

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
  /** Retrieval metadata used by workflow selection. */
  metadata?: CustomizeDocumentMetadata;
  /** Optional trigger terms parsed from frontmatter. */
  triggers?: string[];
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
  /** Retrieval metadata used by on-demand selection. */
  metadata?: CustomizeDocumentMetadata;
  /** Split blocks derived from this document for bounded prompt rendering. */
  blocks?: KnowledgeBlock[];
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
  /** Selected per-run customize content. Absent means legacy full injection. */
  retrieved?: CustomizeRetrievalResult;
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
