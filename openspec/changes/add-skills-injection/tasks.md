## 1. 类型与加载器扩展

- [x] 1.1 在 `src/customize/types.ts` 增加 `SkillDocument` 类型：`{ name: string; description?: string; whenToUse?: string; content: string; charCount: number; sourceFile: string }`
- [x] 1.2 扩展 `CustomizeContext`：增加 `skills: SkillDocument[]` 字段（始终为数组，可为空）
- [x] 1.3 创建 `src/customize/skills.ts`：实现 `loadSkills(customizeDir)` —— 扫描 `customize/skills/*.md`（非递归），返回 `SkillDocument[]`
- [x] 1.4 实现文件名 stem 提取（`device-ssh.md` → `device-ssh`）和字典序排序
- [x] 1.5 在 `src/customize/loader.ts` 的 `loadCustomizeContext` 中调用 `loadSkills`，结果填入 `CustomizeContext.skills`

## 2. Frontmatter 解析

- [x] 2.1 在 `src/customize/skills.ts` 实现极简 frontmatter 解析（手写，无 yaml 依赖）：检测文件开头 `---\n`，到下一个 `---\n` 之间按行解析 `key: value`
- [x] 2.2 支持字段：`name`（缺省用文件名 stem）、`description`、`whenToUse`
- [x] 2.3 容错：frontmatter 格式不正确（无结束 `---`、YAML 语法错）→ 当作无 frontmatter，整个文件内容（含 `---` 行）作为 `content`
- [x] 2.4 从 `content` 中剥离 frontmatter 块（包括两个 `---` 行）

## 3. 文件读取与边界处理

- [x] 3.1 用 UTF-8 强制读取，剥离 UTF-8 BOM
- [x] 3.2 单文件读失败（permission / I/O）：warning 日志 + 跳过该文件，继续加载其他文件
- [x] 3.3 `skills/` 目录不存在：返回空数组，不报错
- [x] 3.4 `skills/` 目录存在但为空：返回空数组
- [x] 3.5 非 `.md` 文件忽略；子目录不递归

## 4. 系统提示词组装扩展

- [x] 4.1 修改 `src/agent/bridge-system-prompt.ts` 的 `buildBridgeSystemPrompt`：在 `<persona>` 块之后追加 `<skills>` 块
- [x] 4.2 `<skills>` 块格式：
  ```
  <skills>
  <skill name="device-ssh">[content]</skill>
  <skill name="camera-doctor">[content]</skill>
  </skills>
  ```
- [x] 4.3 `skills` 为空数组时也注入空块 `<skills></skills>`（让 agent 知道系统支持技能扩展）
- [x] 4.4 当 `customize` 整体为 `undefined`（Change 1 未启用）时，不注入 `<skills>` 块（保持向后兼容）

## 5. Config 卡片扩展

- [x] 5.1 在 `src/card/config-card.ts` 增加 "技能清单" 折叠面板，位于 "人格定制" 面板下方
- [x] 5.2 在 `ConfigFormOpts` 增加 `skills: Array<{ name: string; charCount: number; sourceFile: string }>` 字段
- [x] 5.3 面板内容：每个技能一行 `- {name} ({charCount} 字符)`；空时显示 "_创建 customize/skills/*.md 以激活技能注入_"
- [x] 5.4 在 [src/commands/index.ts](file:///d:/ai/robot/lark-coding-agent-bridge/src/commands/index.ts) 处理 `/config` 命令时从 `loadSkills(customizeDir)` 加载 skills 摘要，填充 `ConfigFormOpts.skills`

## 6. 单元测试

- [x] 6.1 创建 `tests/unit/customize/skills.test.ts`：
  - 多文件加载 + 字典序
  - 非 `.md` 文件忽略
  - 子目录不递归
  - 空目录 / 缺失目录
- [x] 6.2 frontmatter 解析测试：
  - 完整 frontmatter（name/description/whenToUse）
  - 无 frontmatter（用文件名 stem）
  - frontmatter 缺失可选字段
  - 空 name 字段回退到文件名
  - 畸形 frontmatter（无结束 `---`）降级处理
- [x] 6.3 文件读取边界测试：
  - BOM 剥离
  - 单文件读失败不影响其他文件
  - 内容 markdown 结构保留
- [x] 6.4 扩展 `tests/unit/agent/bridge-system-prompt.test.ts`：
  - 有 skills + 有 persona
  - 有 skills + 无 persona
  - 空 skills 数组（注入空块）
  - customize undefined（不注入 skills 块）
- [x] 6.5 扩展 `tests/unit/customize/loader.test.ts`：
  - persona + skills 同时加载
  - skills 单独加载（无 persona）
  - customize disabled 时 skills 也为空

## 7. 集成验证

- [x] 7.1 跑 `npx vitest run tests/unit/customize tests/unit/agent/bridge-system-prompt.test.ts tests/unit/card/config-card.test.ts` 全部通过（74 个测试）
- [x] 7.2 跑 `npx tsc --noEmit` 类型检查通过
- [ ] 7.3 手动验证：在 `~/.lark-channel/profiles/<profile>/customize/skills/` 创建三个测试技能文件（含 frontmatter），`@bot` 触发，通过 `/doctor` 或日志确认 `<skills>` 块注入
- [ ] 7.4 手动验证：删除 `skills/` 目录，确认 `<skills></skills>` 空块仍注入
- [ ] 7.5 手动验证：`/config` 卡片 "技能清单" 面板正确显示
