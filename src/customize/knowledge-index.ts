import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import type { CustomizeConfig, KnowledgeBlock, KnowledgeDocument } from './types';
import { loadKnowledge } from './knowledge';
import { resolveCustomizeDir } from './paths';
import { log } from '../core/logger';

const INDEX_VERSION = 1;
const INDEX_FILE = 'knowledge-index.json';

export interface KnowledgeIndexSource {
  relativePath: string;
  size: number;
  mtimeMs: number;
}

export interface KnowledgeIndexDocument {
  id: string;
  name: string;
  description?: string;
  content: string;
  charCount: number;
  sourceFile: string;
  relativePath?: string;
  searchText?: string;
  blocks: KnowledgeBlock[];
}

export interface KnowledgeIndex {
  version: number;
  generatedAt: string;
  profile: string;
  customizeDir: string;
  sourceHash: string;
  sources: KnowledgeIndexSource[];
  documents: KnowledgeIndexDocument[];
  stats: {
    documents: number;
    blocks: number;
    chars: number;
  };
}

export interface KnowledgeIndexOptions {
  profile: string;
  profileDir: string;
  cacheDir: string;
  customizeConfig: CustomizeConfig;
}

export interface EnsureKnowledgeIndexResult {
  index?: KnowledgeIndex;
  indexPath: string;
  rebuilt: boolean;
  reason: 'disabled' | 'missing-customize' | 'missing-index' | 'stale' | 'fresh' | 'error';
}

export function knowledgeIndexPath(cacheDir: string): string {
  return join(cacheDir, INDEX_FILE);
}

export async function ensureKnowledgeIndex(
  options: KnowledgeIndexOptions,
): Promise<EnsureKnowledgeIndexResult> {
  const indexPath = knowledgeIndexPath(options.cacheDir);
  if (!options.customizeConfig.enabled) {
    return { indexPath, rebuilt: false, reason: 'disabled' };
  }

  const customizeDir = resolveCustomizeDir(options.profileDir, options.customizeConfig);
  let snapshot: KnowledgeSourceSnapshot;
  try {
    snapshot = await snapshotKnowledgeSources(customizeDir);
  } catch (err) {
    log.warn('customize', 'knowledge-index-snapshot-failed', {
      path: customizeDir,
      err: err instanceof Error ? err.message : String(err),
    });
    return { indexPath, rebuilt: false, reason: 'error' };
  }

  if (!snapshot.exists) {
    return { indexPath, rebuilt: false, reason: 'missing-customize' };
  }

  const existing = await readKnowledgeIndex(indexPath);
  if (
    existing &&
    existing.version === INDEX_VERSION &&
    existing.profile === options.profile &&
    existing.customizeDir === customizeDir &&
    existing.sourceHash === snapshot.sourceHash
  ) {
    log.info('customize', 'knowledge-index-fresh', {
      path: indexPath,
      documents: existing.stats.documents,
      blocks: existing.stats.blocks,
    });
    return { index: existing, indexPath, rebuilt: false, reason: 'fresh' };
  }

  const reason = existing ? 'stale' : 'missing-index';
  try {
    const index = await buildKnowledgeIndex({
      profile: options.profile,
      profileDir: options.profileDir,
      cacheDir: options.cacheDir,
      customizeConfig: options.customizeConfig,
      sourceHash: snapshot.sourceHash,
      sources: snapshot.sources,
    });
    log.info('customize', 'knowledge-index-rebuilt', {
      path: indexPath,
      reason,
      documents: index.stats.documents,
      blocks: index.stats.blocks,
      chars: index.stats.chars,
    });
    return { index, indexPath, rebuilt: true, reason };
  } catch (err) {
    log.warn('customize', 'knowledge-index-build-failed', {
      path: indexPath,
      err: err instanceof Error ? err.message : String(err),
    });
    return { indexPath, rebuilt: false, reason: 'error' };
  }
}

export async function loadKnowledgeFromIndex(indexPath: string): Promise<KnowledgeDocument[] | undefined> {
  const index = await readKnowledgeIndex(indexPath);
  if (!index) return undefined;
  return knowledgeDocumentsFromIndex(index);
}

export async function readKnowledgeIndex(indexPath: string): Promise<KnowledgeIndex | undefined> {
  let raw: string;
  try {
    raw = await readFile(indexPath, 'utf8');
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as KnowledgeIndex;
    if (!isKnowledgeIndex(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

interface BuildKnowledgeIndexInput extends KnowledgeIndexOptions {
  sourceHash?: string;
  sources?: KnowledgeIndexSource[];
}

async function buildKnowledgeIndex(input: BuildKnowledgeIndexInput): Promise<KnowledgeIndex> {
  const customizeDir = resolveCustomizeDir(input.profileDir, input.customizeConfig);
  const snapshot =
    input.sourceHash && input.sources
      ? { exists: true, sourceHash: input.sourceHash, sources: input.sources }
      : await snapshotKnowledgeSources(customizeDir);
  const knowledge = snapshot.exists ? await loadKnowledge(customizeDir) : [];
  const documents = knowledge.map(toIndexDocument);
  const index: KnowledgeIndex = {
    version: INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    profile: input.profile,
    customizeDir,
    sourceHash: snapshot.sourceHash,
    sources: snapshot.sources,
    documents,
    stats: {
      documents: documents.length,
      blocks: documents.reduce((sum, doc) => sum + doc.blocks.length, 0),
      chars: documents.reduce((sum, doc) => sum + doc.charCount, 0),
    },
  };

  await mkdir(input.cacheDir, { recursive: true });
  await writeFile(knowledgeIndexPath(input.cacheDir), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  return index;
}

function knowledgeDocumentsFromIndex(index: KnowledgeIndex): KnowledgeDocument[] {
  return index.documents.map((doc) => ({
    name: doc.name,
    ...(doc.description ? { description: doc.description } : {}),
    content: doc.content,
    charCount: doc.charCount,
    sourceFile: doc.sourceFile,
    metadata: {
      id: doc.id,
      relativePath: doc.relativePath ?? '',
      searchText: doc.searchText ?? '',
    },
    blocks: doc.blocks,
  }));
}

function toIndexDocument(doc: KnowledgeDocument): KnowledgeIndexDocument {
  const id = doc.metadata?.id ?? normalizeId(doc.name);
  return {
    id,
    name: doc.name,
    ...(doc.description ? { description: doc.description } : {}),
    content: doc.content,
    charCount: doc.charCount,
    sourceFile: doc.sourceFile,
    ...(doc.metadata?.relativePath ? { relativePath: doc.metadata.relativePath } : {}),
    ...(doc.metadata?.searchText ? { searchText: doc.metadata.searchText } : {}),
    blocks: doc.blocks?.length ? doc.blocks : [documentBlock(doc, id)],
  };
}

interface KnowledgeSourceSnapshot {
  exists: boolean;
  sourceHash: string;
  sources: KnowledgeIndexSource[];
}

async function snapshotKnowledgeSources(customizeDir: string): Promise<KnowledgeSourceSnapshot> {
  const knowledgeDir = join(customizeDir, 'knowledge');
  let sources: KnowledgeIndexSource[];
  try {
    sources = await collectKnowledgeSources(knowledgeDir, knowledgeDir);
  } catch {
    return { exists: false, sourceHash: '', sources: [] };
  }
  if (sources.length === 0) {
    // Directory existed but held no .md files (directly or nested).
    // Treat as "exists, empty" so callers can still build an empty index.
  }
  sources.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const hash = createHash('sha256');
  for (const source of sources) {
    hash.update(`${source.relativePath}\0${source.size}\0${source.mtimeMs}\n`);
  }
  return { exists: true, sourceHash: hash.digest('hex'), sources };
}

/**
 * Recursively collect `*.md` files under `dir`, returning index sources with
 * POSIX-style relative paths (relative to `baseDir`).
 */
async function collectKnowledgeSources(
  dir: string,
  baseDir: string,
): Promise<KnowledgeIndexSource[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const acc: KnowledgeIndexSource[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectKnowledgeSources(fullPath, baseDir);
      acc.push(...nested);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    let st;
    try {
      st = await stat(fullPath);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    acc.push({
      relativePath: relative(baseDir, fullPath).split(sep).join('/'),
      size: st.size,
      mtimeMs: st.mtimeMs,
    });
  }
  return acc;
}

function documentBlock(doc: KnowledgeDocument, id: string): KnowledgeBlock {
  return {
    id,
    documentId: id,
    name: doc.name,
    kind: 'document',
    content: doc.content,
    charCount: doc.charCount,
    sourceFile: doc.sourceFile,
    relativePath: doc.metadata?.relativePath,
    ordinal: 0,
  };
}

function isKnowledgeIndex(value: KnowledgeIndex): value is KnowledgeIndex {
  return (
    value &&
    value.version === INDEX_VERSION &&
    typeof value.profile === 'string' &&
    typeof value.customizeDir === 'string' &&
    typeof value.sourceHash === 'string' &&
    Array.isArray(value.documents) &&
    Boolean(value.stats)
  );
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}
