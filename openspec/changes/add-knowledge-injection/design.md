## Context

Change 1 建立了 `src/customize/` 框架（persona 单文件），Change 2 扩展到多文件目录扫描（skills）。本 change 用相同模式扩展到 knowledge 子目录。系统提示词结构演进为：

```
[BRIDGE_SYSTEM_PROMPT 内容]

<persona>
[SOUL.md]
</persona>

<skills>
<skill name="...">[content]</skill>
</skills>

<knowledge_base>
<knowledge name="...">[content]</knowledge>
</knowledge_base>
```

三层定制各有定位：
- **persona**：身份与铁律（"你是谁、不能做什么"）
- **skills**：能力调用说明（"你能做什么、怎么做"）
- **knowledge**：事实参考库（"你应该知道什么"）

## Goals / Non-Goals

**Goals:**

- `src/customize/knowledge.ts` 扫描 `customize/knowledge/*.md`，返回 `KnowledgeDocument[]`
- 复用 Change 2 的 frontmatter 解析逻辑（提取 `name` / `description`，无 `whenToUse`，因为 knowledge 没有"调用时机"概念）
- 按文件名字典序拼接
- `<knowledge_base>` XML 块注入到 `buildBridgeSystemPrompt`，位于 `<skills>` 之后
- 每个知识文件用 `<knowledge name="...">` 子标签包裹
- `CustomizeContext` 扩展 `knowledge: KnowledgeDocument[]` 字段
- `/config` 卡片新增 "知识库" 折叠面板

**Non-Goals:**

- RAG / 向量检索 / 按需查询（首期全量注入；token 爆炸时再独立 change）
- 知识库版本管理 / diff 历史
- 知识库远程同步（从飞书文档拉取知识库）
- 知识库条目级权限（全部公开给 agent）
- 知识库模板渲染（不渲染 `{{variable}}`）
- 多语言化

## Decisions

### D1: 复用 skills 的加载模式

knowledge 用和 skills 完全相同的目录扫描 + frontmatter 解析 + 字典序拼接逻辑。代码层考虑抽一个共享 helper（如 `loadMarkdownDir(dir, options)`），但首期可以容忍少量重复，先看 knowledge 是否需要不同行为。

**Alt considered**: 立即抽公共 helper —— 拒绝，过早抽象。先看 knowledge 是否真的和 skills 行为一致，再 refactor。

### D2: knowledge 文件可选 frontmatter（无 whenToUse）

和 skills 一样支持 `---\nname: ...\ndescription: ...\n---\n`。但 knowledge 没有"调用时机"概念，所以不支持 `whenToUse` 字段（即使写了也忽略）。

### D3: knowledge 始终注入空块

和 skills 一样，即使 `knowledge/` 目录不存在或为空，也注入空 `<knowledge_base></knowledge_base>` 块，让 agent 知道"系统支持知识库扩展"。

### D4: knowledge 注入位置 = `<skills>` 之后

知识是"参考事实"，agent 在执行技能时引用。persona 定调 → skills 给能力 → knowledge 给事实，层次清晰。

### D5: KnowledgeDocument 类型

`{ name: string; description?: string; content: string; charCount: number; sourceFile: string }`

比 `SkillDocument` 少 `whenToUse` 字段。

### D6: 不做 token 预算控制

首期不预估 token 用量、不截断、不警告超长。`/config` 卡片显示每个知识文件字符数和总字符数，由 owner 自行控制。

**Trade-off**: 知识库可能爆 token，导致 system prompt 过长。可接受——首期华佗知识库体量可控（故障字典 + SN 映射约几百行 markdown）。

## Risks / Trade-offs

- **[Risk] 知识库增长导致 token 爆炸** → 首期由 owner 控制；后续 change 加 RAG 或分页检索
- **[Risk] 知识库内容冲突（多个文件都定义"故障字典"）** → 不做去重，agent 自行判断；文件名命名约定（如 `fault-dictionary.md`、`sn-mapping.md`）避免冲突
- **[Trade-off] 全量注入 vs 按需检索** → 首期全量，简单可靠；可接受 token 开销
- **[Trade-off] 不抽公共 helper** → 和 skills 代码少量重复（约 30-50 行）；后续 refactor 风险低

## Migration Plan

无需迁移：

1. Change 1 + 2 archive 后，`CustomizeContext = { persona?; skills: SkillDocument[] }`
2. 本 change archive 后，`CustomizeContext = { persona?; skills: SkillDocument[]; knowledge: KnowledgeDocument[] }`
3. 现有 profile（无 `customize/knowledge/` 目录）→ `knowledge: []`，注入空 `<knowledge_base></knowledge_base>` 块

激活路径：

- 用户在 `~/.lark-channel/profiles/<profile>/customize/knowledge/` 下创建 `.md` 文件即激活

## Open Questions

无。
