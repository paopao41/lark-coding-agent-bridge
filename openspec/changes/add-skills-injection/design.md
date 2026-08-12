## Context

Change 1 (`add-persona-injection`) 建立了 `src/customize/` 加载框架，目前只加载单文件 `SOUL.md`。华佗需要在同一框架下加载多个技能说明文件（device-ssh、camera-doctor、feishu-docs），并把它们作为 `<skills>` XML 块注入系统提示词。

Change 1 的关键决策已定调（design D7）：

- **persona 放系统提示词层**（profile 级恒定，每轮不变）
- **skills/knowledge 可以放每轮动态层**（按 chat 类型选不同集合）

但本 change 决定 **skills 也放系统提示词层**，理由：

1. 华佗 profile 永远是固定的三个技能，不需要按 chat 类型切换
2. 实现简单（和 persona 同层，复用 `buildBridgeSystemPrompt`）
3. 后续如果有"按 chat 类型选技能"需求，再独立 change 把 skills 下沉到 `buildAgentPrompt` 层

## Goals / Non-Goals

**Goals:**

- `src/customize/skills.ts` 扫描 `customize/skills/*.md`，返回 `SkillDocument[]`
- 支持可选 YAML frontmatter（`name` / `description` / `whenToUse`），缺省用文件名 stem 作为 name
- 按文件名字典序拼接（确定性）
- `<skills>` XML 块注入到 `buildBridgeSystemPrompt`，位于 `<persona>` 之后
- 每个 skill 用 `<skill name="...">` 子标签包裹
- `CustomizeContext` 扩展 `skills: SkillDocument[]` 字段
- `/config` 卡片新增 "技能清单" 折叠面板

**Non-Goals:**

- MCP server 形态的技能封装（用户决策：纯 prompt 注入）
- 技能动态选择（按 chat 类型选不同技能集）—— 留给后续 change
- 技能间依赖关系处理（如 device-ssh 必须在 camera-doctor 之前）—— 文件名字典序已足够（用户可命名 `01-device-ssh.md` 强制排序）
- 技能内容的多语言化
- 技能内容的模板渲染（不渲染 `{{variable}}`，保留原样）

## Decisions

### D1: skills 目录布局 = `customize/skills/*.md`

复用 Change 1 的 `<profileDir>/customize/` 根，新增 `skills/` 子目录。每个 `.md` 文件一个技能。

**Alt considered**: 单文件 `customize/skills.md` 用 YAML 列表 —— 拒绝，单文件难维护、难扩展、单个技能修改要重写整个文件。

### D2: 可选 YAML frontmatter

文件开头可选 `---\nname: device-ssh\ndescription: 设备免密接入\nwhenToUse: 接到报障需要 SSH 时\n---\n`。缺省时用文件名 stem（如 `device-ssh.md` → `device-ssh`）作为 `name`。

**Alt considered**: 强制 frontmatter —— 拒绝，对最简情况（一个 markdown 文件就是技能说明）增加学习成本。

**Alt considered**: 不支持 frontmatter，只用文件名 —— 拒绝，丢失 description/whenToUse 元数据，agent 不知道何时调用哪个技能。

### D3: 按文件名字典序拼接

技能文档按文件名（含扩展名）字典序拼接，结果确定性。

**Trade-off**: 用户需要命名约定来控制顺序（如 `01-device-ssh.md` / `02-camera-doctor.md` / `03-feishu-docs.md`），但比引入显式 priority 字段简单。

### D4: skills 始终注入 `<skills>` 块（即使空数组）

即使 `skills/` 目录不存在或为空，也注入空 `<skills></skills>` 块。这让 agent 知道"系统支持技能扩展，但当前 profile 无技能配置"，避免 agent 误以为系统不支持技能。

**Alt considered**: 空数组时不注入 —— 拒绝，agent 无法区分"系统不支持 skills"和"skills 为空"，可能影响行为决策。

### D5: skills 注入位置 = `<persona>` 之后

系统提示词结构变为：

```
[BRIDGE_SYSTEM_PROMPT 内容]

<persona>
[SOUL.md]
</persona>

<skills>
<skill name="device-ssh">[内容]</skill>
<skill name="camera-doctor">[内容]</skill>
<skill name="feishu-docs">[内容]</skill>
</skills>
```

**Alt considered**: skills 在 persona 之前 —— 拒绝，persona 是身份定调，应在前；skills 是能力清单，应在后。

### D6: 不解析 markdown 内容

技能文件按纯文本读取，不渲染、不解析 markdown AST。frontmatter 只在文件开头检测并剥离。

**理由**: agent（LLM）天然理解 markdown，无需预处理。渲染会丢失原始结构。

### D7: frontmatter 解析容错

- frontmatter 格式不正确（如 YAML 语法错误）→ 当作无 frontmatter，整个文件内容（含 `---` 行）作为 `content`
- `name` 字段为空 → 用文件名 stem
- `description` / `whenToUse` 字段缺失 → 该字段为 `undefined`

不抛异常，降级处理。

## Risks / Trade-offs

- **[Risk] frontmatter YAML 解析引入依赖** → 不引入 `yaml` 包，手写极简 frontmatter 解析（行级正则 + 键值拆分），只支持扁平结构（无嵌套、无列表）。够用且零依赖。
- **[Risk] 技能文件过大导致 token 超限** → 不做硬截断，`/config` 卡片显示每个技能字符数供 owner 控制。
- **[Risk] 文件名包含非 ASCII 字符导致字典序不稳定** → 文件名建议用 kebab-case ASCII（如 `device-ssh.md`），non-ASCII 文件名按 UTF-8 字节序排序（Node.js `Array.sort()` 默认行为）。
- **[Trade-off] 始终注入空 `<skills>` 块** → 多 ~20 字符 token 开销，可接受。
- **[Trade-off] 不支持技能间依赖声明** → 用户通过文件名前缀（`01-`、`02-`）控制顺序，足够。

## Migration Plan

无需迁移：

1. Change 1 archive 后，`customize-loader` spec 包含 `CustomizeContext { persona? }`
2. 本 change archive 后，`CustomizeContext` 扩展为 `{ persona?; skills: SkillDocument[] }`
3. 现有 profile（无 `customize/skills/` 目录）→ `skills: []`，注入空 `<skills></skills>` 块

激活路径：

- 用户在 `~/.lark-channel/profiles/<profile>/customize/skills/` 下创建 `.md` 文件即激活

回滚：

- 删除 `skills/` 目录或文件 → `skills: []`，注入空块
- 源码改动可 git revert

## Open Questions

无。
