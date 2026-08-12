## Why

当前 bridge 把系统提示词（`BRIDGE_SYSTEM_PROMPT`）写死在源码 [src/agent/bridge-system-prompt.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/bridge-system-prompt.ts) 中，所有 profile 共用一份，无法按 bot 实例定制身份、铁律、响应风格。

要在 bridge 之上做"华佗"诊断机器人二次开发，必须满足三条硬约束（来自 `D:\ai\robot\华佗——机器人诊断AI设计文档.md` 第 2、6 节）：

1. **解耦**：定制内容（人格、技能、知识库、记忆）放数据卷文件系统，不放源码。
2. **升级不丢失**：底座（bridge 源码）git pull / 重建镜像时，定制层保留。
3. **可扩展**：后续 skills / knowledge / memory 等扩展点能复用同一加载框架。

本 change 作为首期三件套（persona / skills / knowledge）的第一件，负责建立 `customize/` 加载框架，并以 SOUL.md 人格注入作为第一个使用者。组合方式采用用户确认的"BRIDGE 在前 + SOUL 追加"——保留 bridge 运行必需指令（botOpenId 自识别、bot-at-bot 协作、quoted_message、interactive_card 回调），SOUL.md 作为 `<persona>` 块追加在后。

## What Changes

- **新增 `src/customize/` 模块**：customize 层加载框架
  - `paths.ts`：计算 `~/.lark-channel/profiles/<profile>/customize/` 路径
  - `types.ts`：`CustomizeContext`、`PersonaContent` 等类型
  - `loader.ts`：启动时扫描 `customize/` 目录，返回 `CustomizeContext`
  - `persona.ts`：加载 `SOUL.md`，返回结构化 persona 内容
- **改造系统提示词组装**：
  - `BRIDGE_SYSTEM_PROMPT` 保留为 bridge 运行必需指令（不动其内容）
  - `buildBridgeSystemPrompt(identity, customize?)` 增加可选 `customize` 参数
  - 在 bridge 系统提示词末尾追加 `<persona>` XML 块（仅当 `customize.persona` 存在时）
- **profile-schema 扩展**：
  - `ProfileConfig` 增加 `customize?: { enabled: boolean; dir?: string }` 字段
  - `normalizeCustomize()` 规范化函数（默认 `enabled: true`，dir 缺省时用标准路径）
- **adapter 接入**：
  - `src/agent/claude/adapter.ts` 和 `src/agent/codex/adapter.ts` 把 customize 注入的系统提示词透传给子进程
- **channel 接入**：
  - `src/bot/channel.ts` 在 `buildPrompt` 阶段加载 customize，注入到 agent run
- **环境变量注入**：
  - `src/agent/lark-channel-env.ts` 增加 `LARK_CHANNEL_CUSTOMIZE_DIR`，让 agent 子进程知道定制目录位置（后续 memory/产物写入需要）
- **config-card 展示**：
  - `src/card/config-card.ts` 增加"人格定制"折叠面板，显示 SOUL.md 是否加载、路径、字符数
- **数据卷契约**：
  - 默认路径 `~/.lark-channel/profiles/<profile>/customize/SOUL.md`
  - SOUL.md 不存在时不报错（向后兼容，customize 字段 enabled 但目录空 = 无操作）
  - 文件读取失败时记录 warning 并降级为不注入，不阻塞 agent 启动

## Capabilities

### New Capabilities

- `customize-loader`: 启动时扫描 profile 数据卷下的 `customize/` 目录，加载定制层（persona / 后续 skills / knowledge / memory 的统一入口）。返回 `CustomizeContext` 给 prompt 组装。支持 enabled 开关、自定义目录路径、加载失败的优雅降级。
- `persona-injection`: 把数据卷 `customize/SOUL.md` 作为 `<persona>` XML 块追加到系统提示词末尾（BRIDGE_SYSTEM_PROMPT 之后）。SOUL.md 定义 bot 的身份、铁律、响应风格。无 SOUL.md 时无操作。

### Modified Capabilities

（无——本 change 是首期第一个，没有已存在的 openspec spec 需要修改）

## Impact

**新增代码**：
- `src/customize/paths.ts`
- `src/customize/types.ts`
- `src/customize/loader.ts`
- `src/customize/persona.ts`

**修改代码**：
- [src/agent/bridge-system-prompt.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/bridge-system-prompt.ts)（`buildBridgeSystemPrompt` 签名扩展）
- [src/agent/claude/adapter.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/claude/adapter.ts)（透传 customize）
- [src/agent/codex/adapter.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/codex/adapter.ts)（透传 customize）
- [src/agent/types.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/types.ts)（`AgentRunInput` 增加 customize 字段）
- [src/agent/lark-channel-env.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/lark-channel-env.ts)（注入 `LARK_CHANNEL_CUSTOMIZE_DIR`）
- [src/bot/channel.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/bot/channel.ts)（buildPrompt 加载 customize）
- [src/config/profile-schema.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/config/profile-schema.ts)（`customize` 字段 + normalize）
- [src/card/config-card.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/card/config-card.ts)（人格定制面板）

**数据卷契约**：
- `~/.lark-channel/profiles/<profile>/customize/SOUL.md`（可选，UTF-8 markdown）

**测试**：
- `tests/unit/customize/loader.test.ts`（路径解析、空目录、缺失文件、加载失败降级）
- `tests/unit/customize/persona.test.ts`（SOUL.md 读取、空文件、超长截断）
- `tests/unit/agent/bridge-system-prompt.test.ts`（追加，验证 customize 注入）
- `tests/unit/config/profile-schema.test.ts`（追加，验证 customize 字段规范化）

**向后兼容**：
- `customize` 字段缺省时行为完全等同当前实现（无 persona 注入）
- 现有 profile 配置不需要迁移
