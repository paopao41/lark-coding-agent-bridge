import type {
  CustomizeContext,
  CustomizeRetrievalResult,
  KnowledgeBlock,
  KnowledgeDocument,
  SkillDocument,
} from './types';
import type { RequestClassification } from '../bot/request-classifier';

const DEFAULT_MAX_SKILLS = 3;
const DEFAULT_MAX_BLOCKS = 6;
const DEFAULT_MAX_CHARS = 12_000;

export interface SelectCustomizeRetrievalInput {
  query: string;
  customize: CustomizeContext;
  classification?: RequestClassification;
  maxSkills?: number;
  maxBlocks?: number;
  maxChars?: number;
}

export function selectCustomizeRetrieval(input: SelectCustomizeRetrievalInput): CustomizeRetrievalResult {
  const maxSkills = input.maxSkills ?? DEFAULT_MAX_SKILLS;
  const maxBlocks = input.maxBlocks ?? DEFAULT_MAX_BLOCKS;
  const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS;
  const terms = queryTerms(input.query);
  const skills = selectSkills(input.customize.skills, terms, input.classification, maxSkills);
  const rankedBlocks = rankKnowledgeBlocks(input.customize.knowledge, terms, input.classification);
  const blocks: KnowledgeBlock[] = [];
  let totalChars = skills.reduce((sum, skill) => sum + skill.charCount, 0);

  for (const block of rankedBlocks) {
    if (blocks.length >= maxBlocks) break;
    if (totalChars + block.charCount > maxChars && blocks.length > 0) break;
    blocks.push(block);
    totalChars += block.charCount;
  }

  const selectedKnowledgeIds = Array.from(new Set(blocks.map((block) => block.documentId)));
  const allKnowledgeIds = input.customize.knowledge.map((doc) => documentId(doc));
  return {
    skills,
    knowledge: input.customize.knowledge.filter((doc) => selectedKnowledgeIds.includes(documentId(doc))),
    blocks,
    trace: {
      query: input.query,
      selectedSkillIds: skills.map((skill) => documentId(skill)),
      selectedKnowledgeIds,
      selectedBlockIds: blocks.map((block) => block.id),
      omittedKnowledgeIds: allKnowledgeIds.filter((id) => !selectedKnowledgeIds.includes(id)),
      totalChars,
      reason: blocks.length > 0 || skills.length > 0
        ? 'selected by deterministic metadata relevance'
        : 'no metadata match; prompt renderer may use compatibility fallback',
    },
  };
}

function selectSkills(
  skills: SkillDocument[],
  terms: string[],
  classification: RequestClassification | undefined,
  maxSkills: number,
): SkillDocument[] {
  const selectedIds = new Set(classification?.selectedSkillIds ?? []);
  return skills
    .map((skill, index) => ({ skill, index, score: scoreSkill(skill, terms, selectedIds) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxSkills)
    .map((entry) => entry.skill);
}

function rankKnowledgeBlocks(
  knowledge: KnowledgeDocument[],
  terms: string[],
  classification: RequestClassification | undefined,
): KnowledgeBlock[] {
  const selectedIds = new Set(classification?.selectedKnowledgeIds ?? []);
  return knowledge
    .flatMap((doc, docIndex) => {
      const id = documentId(doc);
      const blocks = doc.blocks && doc.blocks.length > 0 ? doc.blocks : [documentBlock(doc, id)];
      return blocks.map((block, blockIndex) => ({
        block,
        docIndex,
        blockIndex,
        score: scoreKnowledge(doc, block, terms, selectedIds),
      }));
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.docIndex - b.docIndex || a.blockIndex - b.blockIndex)
    .map((entry) => entry.block);
}

function scoreSkill(skill: SkillDocument, terms: string[], selectedIds: Set<string>): number {
  const id = documentId(skill);
  let score = selectedIds.has(id) ? 100 : 0;
  const haystack = [
    id,
    skill.name,
    skill.description,
    skill.whenToUse,
    skill.metadata?.relativePath,
    skill.metadata?.searchText,
    ...(skill.triggers ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  score += scoreTerms(haystack, terms);
  return score;
}

function scoreKnowledge(
  doc: KnowledgeDocument,
  block: KnowledgeBlock,
  terms: string[],
  selectedIds: Set<string>,
): number {
  const id = documentId(doc);
  let score = selectedIds.has(id) ? 100 : 0;
  const haystack = [
    id,
    doc.name,
    doc.description,
    doc.metadata?.relativePath,
    doc.metadata?.searchText,
    block.name,
    block.relativePath,
    block.content.slice(0, 800),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  score += scoreTerms(haystack, terms);
  return score;
}

function scoreTerms(haystack: string, terms: string[]): number {
  let score = 0;
  for (const term of terms) {
    if (term.length < 2) continue;
    if (haystack.includes(term)) score += term.length > 3 ? 2 : 1;
  }
  return score;
}

function queryTerms(query: string): string[] {
  return Array.from(new Set(query.toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(Boolean)));
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

function documentId(doc: Pick<SkillDocument | KnowledgeDocument, 'name' | 'metadata'>): string {
  return doc.metadata?.id ?? normalizeId(doc.name);
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}
