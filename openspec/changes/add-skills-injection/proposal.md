## Why

Change 1 (`add-persona-injection`) 建立了 `src/customize/` 加载框架和 `<persona>` 注入机制。华佗还需要三个专用技能的调用说明注入到系统提示词：

1. **device-ssh** —— 已有本地 ssh-skill（用户确认），需要把"如何调用 ssh-skill"的提示词告诉 agent
2. **camera-doctor** —— 已有知识库（Change 3 处理），需要把"查询知识库诊断相机"的标准流程提示词告诉 agent
3. **feishu-docs** —— bridge 本身已注入 lark-cli，agent 直接用，需要把"用 lark-cli 读飞书文档作为方法库"的提示词告诉 agent

按华佗设计文档第 4 节："技能体系——只保留三个与职责相关的技能，其余数十个预装技能全部禁用，收敛行为、避免误触发。"

技能内容是 **profile 级恒定**（华佗 profile 永远是这三个技能），所以放系统提示词层（和 persona 同层），不放每轮动态层。后续如果有"按 chat 类型选不同技能集"需求，再独立 change 处理。

## What Changes

- **扩展 `src/customize/` 加载器**：从单文件（SOUL.md）扩展到多文件目录扫描
  - `src/customize/types.ts`：`CustomizeContext` 增加 `skills: SkillDocument[]` 字段
  - `src/customize/skills.ts`（新增）：扫描 `customize/skills/*.md`，每个文件解析为 `SkillDocument { name; description?; whenToUse?; content }`
- **支持 frontmatter**：技能文件可选 YAML frontmatter（`---\nname: device-ssh\ndescription: ...\n---\n`），缺省时用文件名（去扩展名）作为 name
- **系统提示词组装扩展**：
  - `buildBridgeSystemPrompt(identity, customize?)` 在 `<persona>` 之后追加 `<skills>` XML 块
  - `<skills>` 块内每个技能用 `<skill name="...">` 子标签包裹内容
- **加载顺序**：按文件名字典序拼接（确定性，便于调试）
- **config-card 扩展**：在 "人格定制" 面板下方新增 "技能清单" 折叠面板，列出已加载技能名和字符数
- **环境变量**：复用 Change 1 的 `LARK_CHANNEL_CUSTOMIZE_DIR`，agent 子进程可读取 `customize/skills/` 目录

## Capabilities

### New Capabilities

- `skills-injection`: 把 `customize/skills/*.md` 目录下所有技能文件作为 `<skills>` XML 块注入系统提示词（在 `<persona>` 之后）。支持 YAML frontmatter 提取 name/description/whenToUse。按文件名字典序拼接。

### Modified Capabilities

- `customize-loader`: 扩展 `loadCustomizeContext` 同时加载 persona 和 skills。`CustomizeContext` 类型从 `{ persona? }` 扩展为 `{ persona?; skills: SkillDocument[] }`。skills 字段始终存在（空数组也合法），persona 仍为可选。
