## Context

当前 bridge 在 [src/agent/bridge-system-prompt.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/bridge-system-prompt.ts) 把 `BRIDGE_SYSTEM_PROMPT` 写死为常量，所有 profile 共用一份。系统提示词由两个层级组装：

1. **bridge 系统提示词层**（恒定）：`BRIDGE_SYSTEM_PROMPT` 包含 bridge 运行必需指令（botOpenId 自识别、bot-at-bot 协作、quoted_message 引用上下文、interactive_card 回调约定）。通过 [src/agent/claude/adapter.ts:54-67](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/claude/adapter.ts#L54-L67) `--append-system-prompt-file` 或 [src/agent/codex/adapter.ts:99](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/codex/adapter.ts#L99) `prefixBridgeSystemPrompt` 注入子进程。
2. **每轮 prompt 层**（动态）：[src/agent/prompt.ts:88-110](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/prompt.ts#L88-L110) `buildAgentPrompt` 把 `<bridge_context>`、`<bridge_instructions>`、`<topic_context>`、`<quoted_messages>`、`<user_input>` 等 XML 块拼起来，每轮变化。

华佗机器人需要在 bridge 之上注入 SOUL.md（身份/铁律/响应风格），并满足三条硬约束（来自 `D:\ai\robot\华佗——机器人诊断AI设计文档.md` 第 2、6 节）：

- **解耦**：定制内容放数据卷文件系统，不放源码
- **升级不丢失**：底座 git pull / 重建镜像时定制层保留
- **可扩展**：后续 skills / knowledge / memory 等扩展点能复用同一加载框架

数据卷基础已存在：[src/config/app-paths.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/config/app-paths.ts) `resolveAppPaths` 已经按 `~/.lark-channel/profiles/<profile>/` 组织所有 profile 状态（sessions、workspaces、secrets、lark-cli、media、logs），customize 子目录是自然扩展。

## Goals / Non-Goals

**Goals:**

- 建立 `src/customize/` 加载框架，作为后续 skills/knowledge/memory 扩展点的统一入口
- SOUL.md 注入到系统提示词末尾作为 `<persona>` XML 块
- 数据卷默认路径 `~/.lark-channel/profiles/<profile>/customize/SOUL.md`
- 加载失败优雅降级，不阻塞 agent 启动
- profile 配置 `customize: { enabled; dir? }` 控制开关和路径覆盖
- 注入 `LARK_CHANNEL_CUSTOMIZE_DIR` 环境变量给 agent 子进程
- `/config` 卡片新增"人格定制"面板展示加载状态

**Non-Goals:**

- skills 提示词注入（Change 2 处理）
- knowledge 知识库注入（Change 3 处理）
- memory 持久化（首期不做，agent 结构化输出 + bridge 解析机制留给后续）
- 会话过期机制（24h 闲置重置留给后续）
- 回复层秘密脱敏（logger 脱敏已有，回复脱敏留给后续）
- MCP server 形态的技能封装（用户决策：纯 prompt 注入）
- 替换 `BRIDGE_SYSTEM_PROMPT`（用户决策：BRIDGE 在前 + SOUL 追加）
- web UI 扩展（首期只动 `/config` 卡片，Web Console 留给后续）

## Decisions

### D1: 数据卷目录布局 = `<profileDir>/customize/`

复用现有 `resolveAppPaths` 体系，customize 子目录自然挂在 profile 目录下，自动获得 profile 隔离、备份、迁移能力。

**Alt considered**: `~/.lark-channel-customize/<profile>/` 平铺——拒绝，破坏现有 profile 化路径约定，备份脚本要改两处。

### D2: persona 注入位置 = `BRIDGE_SYSTEM_PROMPT` 之后，作为 `<persona>` XML 块

按用户决策"BRIDGE 在前 + SOUL 追加"。bridge 运行必需指令（botOpenId 自识别、bot-at-bot、quoted_message、interactive_card）保留在前面定调运行约定；SOUL.md 作为 `<persona>` 块追加在后定义身份铁律。

**Alt considered**:
- SOUL 在前 BRIDGE 在后——拒绝，agent 可能更看重靠后的内容反而弱化 bridge 运行约定
- SOUL 完全替换 BRIDGE——拒绝，agent 不知道 bridge 运行约定会行为异常（例如不识别 bot-at-bot 协作）

### D3: 加载时机 = agent run 启动时（每次 run 重新读取）

每次 `buildPrompt` 调用前重新读 SOUL.md。修改 SOUL.md 后下一次 @ 触发立即生效，无需重启进程。

**Alt considered**: 进程启动时加载并缓存——拒绝，改文件后要重启 bridge 才生效，违背"数据卷即配置"的设计意图。

**Trade-off**: 每次读盘有一次小文件 IO，远小于 LLM 调用成本，可接受。

### D4: SOUL.md 缺失/失败 = 优雅降级

文件不存在 → 不注入（向后兼容现有 profile）。文件存在但读失败 → warning 日志 + 不注入 + 不抛异常。`/config` 卡片展示加载状态。

**Alt considered**: 强制要求 SOUL.md 存在——拒绝，破坏现有 profile，所有现有用户升级后第一次启动就报错。

### D5: profile 配置字段 = `customize: { enabled: boolean; dir?: string }`

`enabled` 默认 `true`（开关）。`dir` 可选绝对路径，覆盖默认 `<profileDir>/customize/`（用于测试或多套定制切换）。`normalizeCustomize()` 规范化。

**Alt considered**: 单独 `customizeDir: string`——拒绝，缺少禁用开关，且和 `enabled` 语义冲突时无明确优先级。

### D6: 环境变量注入 = `LARK_CHANNEL_CUSTOMIZE_DIR`

挂到现有 [src/agent/lark-channel-env.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/lark-channel-env.ts) 的 `LARK_CHANNEL_*` 环境变量组。让 agent 子进程知道定制目录位置，为后续 memory/产物写入铺路。

`enabled: false` 或目录不存在时不设置该环境变量（避免 agent 误读不存在的路径）。

### D7: 修改层级 = 系统提示词层（不改 `buildAgentPrompt` 的 XML 块）

persona 是 profile 级恒定身份，每轮 run 不变，放系统提示词层。区别于 skills/knowledge（后续可能按 chat 类型选不同集合，属于每轮动态层）。

所以本 change 修改 `buildBridgeSystemPrompt` 而非 `buildAgentPrompt`。后续 skills/knowledge 可考虑放 `buildAgentPrompt` 层。

## Risks / Trade-offs

- **[Risk] SOUL.md 包含 prompt injection** → 文件由 profile owner 控制（与现有 `secrets.enc` 同信任级），不接收远端用户输入。Profile owner 自负其责。
- **[Risk] 文件编码问题（BOM/非 UTF-8）** → loader 用 `utf-8` 强制读取，BOM 自动剥离。非 UTF-8 文件读出乱码时由 `/config` 卡片显示字符数提醒。
- **[Risk] SOUL.md 过长导致 token 超限** → 不做硬截断（破坏人格完整性），仅在 `/config` 卡片显示字符数供 owner 自行控制。
- **[Trade-off] 每次读盘** → 一次小文件 IO，远小于 LLM 调用成本，可接受。
- **[Trade-off] `enabled` 默认 `true`** → 现有 profile 升级后默认开启加载，但目录不存在 = 无操作，行为等同当前实现。无破坏性。

## Migration Plan

无需迁移：

1. 现有 profile 没有 `customize` 字段 → `normalizeCustomize` 默认 `{ enabled: true; dir: undefined }`
2. 目录不存在 → loader 返回空 `CustomizeContext`，不注入 persona
3. 行为完全等同当前实现

激活路径：

- 用户创建 `~/.lark-channel/profiles/<profile>/customize/SOUL.md` 即激活 persona 注入
- `/config` 卡片可看到加载状态

回滚：

- 删除 SOUL.md 或在 `/config` 设置 `customize.enabled = false` 即禁用
- 源码改动可 git revert，不影响数据卷

## Open Questions

无——首期决策点已在 proposal 阶段经 AskUserQuestion 确认。
