## Why

Change 1 (`add-persona-injection`) 和 Change 2 (`add-skills-injection`) 已建立 `customize/` 加载框架，支持 persona 和 skills 注入。华佗还需要"知识库"注入——故障字典、SN↔端口↔头胸左右手映射、机型对照表、CAN 总线排查手册等参考事实，供 agent 在诊断时引用。

按华佗设计文档第 4.2 节："判读内置专家经验：占用=健康、抓图成功=硬件全排除、cfg空=电气层故障、5.15固件=偏暗根因、SN↔端口↔头胸左右手免接触映射等。"——这些是事实型知识，区别于 skills（操作指引）和 persona（身份铁律）。

知识库和 skills 都放系统提示词层（profile 级恒定），首期最小可用方案是全量注入到 `<knowledge_base>` 块。如果后续知识库体量增长导致 token 爆炸，再独立 change 加 RAG/分页检索机制。

## What Changes

- **扩展 `src/customize/` 加载器**：增加 `knowledge/` 子目录扫描
  - `src/customize/types.ts`：`CustomizeContext` 增加 `knowledge: KnowledgeDocument[]` 字段
  - `src/customize/knowledge.ts`（新增）：扫描 `customize/knowledge/*.md`，每个文件解析为 `KnowledgeDocument { name; description?; content; charCount; sourceFile }`
- **支持 frontmatter**（同 skills）：可选 YAML frontmatter 提取 name/description
- **系统提示词组装扩展**：
  - `buildBridgeSystemPrompt(identity, customize?)` 在 `<skills>` 之后追加 `<knowledge_base>` XML 块
  - 每个知识文件用 `<knowledge name="...">` 子标签包裹内容
- **加载顺序**：按文件名字典序拼接
- **config-card 扩展**：在 "技能清单" 下方新增 "知识库" 折叠面板
- **复用环境变量**：`LARK_CHANNEL_CUSTOMIZE_DIR` 已注入，agent 子进程可访问 `customize/knowledge/` 目录

## Capabilities

### New Capabilities

- `knowledge-injection`: 把 `customize/knowledge/*.md` 目录下所有知识库文件作为 `<knowledge_base>` XML 块注入系统提示词（在 `<skills>` 之后）。支持 YAML frontmatter 提取 name/description。按文件名字典序拼接。空数组时注入空块。

### Modified Capabilities

- `customize-loader`: 扩展 `loadCustomizeContext` 同时加载 persona、skills、knowledge。`CustomizeContext` 类型扩展为 `{ persona?; skills: SkillDocument[]; knowledge: KnowledgeDocument[] }`。knowledge 字段始终存在（空数组也合法）。
