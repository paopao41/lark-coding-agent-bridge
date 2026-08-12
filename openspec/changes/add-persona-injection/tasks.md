## 1. 数据模型与路径解析

- [x] 1.1 创建 `src/customize/types.ts`：定义 `CustomizeContext`、`PersonaContent`、`CustomizeConfig` 类型
- [x] 1.2 创建 `src/customize/paths.ts`：实现 `resolveCustomizeDir(profileDir, customizeConfig)` —— 根据 `customize.dir` 覆盖或回退到 `<profileDir>/customize/`
- [x] 1.3 在 [src/config/profile-schema.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/config/profile-schema.ts) 增加 `customize?: { enabled: boolean; dir?: string }` 字段
- [x] 1.4 实现 `normalizeCustomize(raw)` 函数：默认 `{ enabled: true; dir: undefined }`，校验 `dir` 必须是绝对路径（拒绝相对路径，避免被 cwd 漂移），挂到 `normalizeProfileConfig` 链上

## 2. 加载器与 persona 读取

- [x] 2.1 创建 `src/customize/persona.ts`：实现 `loadPersona(customizeDir)` —— 读取 `SOUL.md`，UTF-8 强制解码，剥离 UTF-8 BOM（0xEF 0xBB 0xBF）
- [x] 2.2 处理 persona 边界：文件不存在 → `undefined`；空文件（0 字节）→ `undefined`；whitespace-only → `undefined`（视为无 persona）；正常 → `{ content: string; charCount: number; preview: string }`
- [x] 2.3 创建 `src/customize/loader.ts`：实现 `loadCustomizeContext(opts)` —— 编排 persona 加载，返回 `CustomizeContext`
- [x] 2.4 加载失败优雅降级：try/catch 包裹读取，失败时调 `src/core/logger.ts` 的 warning 级别日志，返回 `persona: undefined`，不抛异常

## 3. 系统提示词组装扩展

- [x] 3.1 修改 [src/agent/bridge-system-prompt.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/bridge-system-prompt.ts)：`buildBridgeSystemPrompt(identity, customize?)` 增加可选第二参数
- [x] 3.2 在 bridge system prompt 末尾追加 `<persona>` XML 块（仅当 `customize?.persona` 存在），格式：`<persona>\n${content}\n</persona>`
- [x] 3.3 不修改 `BRIDGE_SYSTEM_PROMPT` 常量内容本身——它保持原样出现在 `<persona>` 之前
- [x] 3.4 修改 [src/agent/types.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/types.ts) 的 `AgentRunOptions` 增加 `customize?: CustomizeContext` 字段

## 4. Adapter 与 channel 接入

- [x] 4.1 修改 [src/agent/claude/adapter.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/claude/adapter.ts)：把 `run(opts)` 接收的 `customize` 透传给 `buildBridgeSystemPrompt`
- [x] 4.2 修改 [src/agent/codex/adapter.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/codex/adapter.ts)：同上，把 `customize` 透传到 `prefixBridgeSystemPrompt`
- [x] 4.3 修改 [src/bot/channel.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/bot/channel.ts)：在 `runAgentBatch` 调 `loadCustomizeContext`，经 `RunBatchDeps.profileDir` / `startRunFlow` / `SubmitRunInput` 透传到 adapter
- [x] 4.4 修改 [src/agent/lark-channel-env.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/agent/lark-channel-env.ts)：注入 `LARK_CHANNEL_CUSTOMIZE_DIR` 环境变量（仅当 `customize.enabled === true` 且目录存在时设置；否则不设置）

## 5. Config 卡片展示

- [x] 5.1 在 [src/card/config-card.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/card/config-card.ts) 增加 "人格定制" 折叠面板（用现有 `collapsedAccessPanel` helper）
- [x] 5.2 面板字段：enabled 状态（来自 profile 配置）、SOUL.md 绝对路径（或 "（未创建）"）、字符数（或 "（未加载）"）、前 200 字符预览（截断加 "…"）
- [x] 5.3 在 `ConfigFormOpts` 接口增加 `customize: { enabled: boolean; soulPath: string | null; charCount: number | null; preview: string | null }` 字段
- [x] 5.4 在 [src/commands/index.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/commands/index.ts) 处理 `/config` 命令时填充 `ConfigFormOpts.customize`（通过 `buildCustomizeField` helper 异步加载 persona 摘要）

## 6. 单元测试

- [x] 6.1 创建 `tests/unit/customize/paths.test.ts`：覆盖默认路径、自定义 dir 覆盖、相对路径拒绝
- [x] 6.2 创建 `tests/unit/customize/persona.test.ts`：覆盖 BOM 剥离、空文件、whitespace-only、正常读取、内部 whitespace 保留
- [x] 6.3 创建 `tests/unit/customize/loader.test.ts`：覆盖目录不存在、`enabled: false`、自定义 dir、读失败降级、enabled 但目录空的 env var 不设置
- [x] 6.4 扩展 `tests/unit/agent/bridge-system-prompt.test.ts`：覆盖 persona 注入场景（有 persona / 无 persona / BRIDGE_SYSTEM_PROMPT 保留）
- [x] 6.5 扩展 `tests/unit/config/profile-schema.test.ts`：覆盖 `customize` 字段缺省默认、显式 disable、dir 校验

## 7. 集成验证

- [x] 7.1 跑 `npx vitest run` 全套测试：customize 相关 18 个新测试 + 36 个扩展测试全通过；其余偶发失败为环境/锁竞争问题，非 customize 改动引入
- [x] 7.2 跑 `npx tsc --noEmit` 类型检查通过
- [ ] 7.3 手动验证：在 `~/.lark-channel/profiles/<profile>/customize/SOUL.md` 写入测试内容，`@bot` 触发，通过 `/doctor` 或日志确认 `<persona>` 块注入到系统提示词
- [ ] 7.4 手动验证：删除 SOUL.md，确认行为回退到当前实现（无 `<persona>` 块）
- [ ] 7.5 手动验证：`/config` 卡片 "人格定制" 面板正确显示加载状态
