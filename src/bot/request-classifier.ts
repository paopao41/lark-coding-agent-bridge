import type { CustomizeContext, KnowledgeDocument, SkillDocument } from '../customize/types';

export type RequestComplexity = 'simple' | 'diagnostic' | 'open-ended';
export type RequestWorkflow = 'none' | 'hwato-diagnostic' | 'hwato-documentation';
export type RequestToolNeed = 'none' | 'read-only' | 'tool-heavy';

export interface RequestClassification {
  workflow: RequestWorkflow;
  complexity: RequestComplexity;
  toolNeed: RequestToolNeed;
  selectedSkillIds: string[];
  selectedKnowledgeIds: string[];
  reason: string;
}

const DIAGNOSTIC_HINTS = [
  'diagnostic',
  'debug',
  'troubleshoot',
  'trouble shoot',
  'error',
  'exception',
  'fault',
  '故障',
  '排查',
  '定位',
  '日志',
  '报错',
];

const DOCUMENTATION_HINTS = [
  'document',
  'doc',
  'docs',
  'documentation',
  'readme',
  'summary',
  'guide',
  '手册',
  '文档',
  '说明',
  '知识',
];

const TOOL_HINTS = [
  'tool',
  'read file',
  'file',
  'search',
  'grep',
  'inspect',
  'investigate',
  'diagnostic',
  'debug',
  'trace',
  'find',
];

export function classifyRequest(input: {
  prompt: string;
  customize?: CustomizeContext;
}): RequestClassification {
  const text = normalize(input.prompt);
  const hasDiagnostic = includesAny(text, DIAGNOSTIC_HINTS);
  const hasDocumentation = includesAny(text, DOCUMENTATION_HINTS);
  const selectedSkillIds = selectSkillIds(input.customize?.skills ?? [], text);
  const selectedKnowledgeIds = selectKnowledgeIds(input.customize?.knowledge ?? [], text);
  const hasWorkflowSkill = selectedSkillIds.length > 0;
  const selectedIds = [...selectedSkillIds, ...selectedKnowledgeIds];
  const hasToolNeed = includesAny(text, TOOL_HINTS) || selectedIds.length > 0;

  if (hasWorkflowSkill || hasDiagnostic) {
    return {
      workflow: 'hwato-diagnostic',
      complexity: hasToolNeed ? 'diagnostic' : 'open-ended',
      toolNeed: hasToolNeed ? 'tool-heavy' : 'read-only',
      selectedSkillIds,
      selectedKnowledgeIds,
      reason: hasWorkflowSkill
        ? `matched workflow skill(s): ${selectedSkillIds.join(', ')}`
        : 'matched diagnostic workflow hints',
    };
  }

  if (hasDocumentation) {
    return {
      workflow: 'hwato-documentation',
      complexity: selectedIds.length > 0 ? 'diagnostic' : 'simple',
      toolNeed: selectedIds.length > 0 ? 'read-only' : 'none',
      selectedSkillIds,
      selectedKnowledgeIds,
      reason: selectedKnowledgeIds.length > 0
        ? `matched knowledge reference(s): ${selectedKnowledgeIds.join(', ')}`
        : 'matched documentation hints',
    };
  }

  return {
    workflow: 'none',
    complexity: hasToolNeed ? 'diagnostic' : 'simple',
    toolNeed: hasToolNeed ? 'read-only' : 'none',
    selectedSkillIds,
    selectedKnowledgeIds,
    reason: selectedIds.length > 0
      ? `matched reference content: ${selectedIds.join(', ')}`
      : 'no workflow hints matched',
  };
}

function selectSkillIds(skills: SkillDocument[], text: string): string[] {
  return skills
    .filter((skill) => scoreSkill(skill, text) > 0)
    .map((skill) => skill.metadata?.id ?? normalizeId(skill.name))
    .slice(0, 3);
}

function selectKnowledgeIds(knowledge: KnowledgeDocument[], text: string): string[] {
  return knowledge
    .filter((doc) => scoreKnowledge(doc, text) > 0)
    .map((doc) => doc.metadata?.id ?? normalizeId(doc.name))
    .slice(0, 5);
}

function scoreSkill(skill: SkillDocument, text: string): number {
  const haystack = buildHaystack([
    skill.name,
    skill.description,
    skill.whenToUse,
    skill.metadata?.searchText,
  ]);
  return scoreText(text, haystack);
}

function scoreKnowledge(doc: KnowledgeDocument, text: string): number {
  const haystack = buildHaystack([
    doc.name,
    doc.description,
    doc.metadata?.searchText,
    firstHeading(doc.content),
  ]);
  return scoreText(text, haystack);
}

function scoreText(text: string, haystack: string): number {
  let score = 0;
  for (const token of text.split(/\s+/)) {
    if (!token) continue;
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

function buildHaystack(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function firstHeading(content: string): string | undefined {
  return content
    .split('\n')
    .find((line) => line.startsWith('# '))
    ?.replace(/^#+\s*/, '')
    .trim();
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}
