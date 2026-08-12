## 1. 类型与加载器扩展

- [x] 1.1 在 `src/customize/types.ts` 增加 `KnowledgeDocument` 类型：`{ name: string; description?: string; content: string; charCount: number; sourceFile: string }`（注意：无 `whenToUse` 字段）
- [x] 1.2 扩展 `CustomizeContext`：增加 `knowledge: KnowledgeDocument[]` 字段（始终为数组，可为空）
- [x] 1.3 创建 `src/customize/knowledge.ts`：实现 `loadKnowledge(customizeDir)` —— 扫描 `customize/knowledge/*.md`（非递归），返回 `KnowledgeDocument[]`
- [x] 1.4 实现文件名 stem 提取和字典序排序（复用 skills 模式，考虑抽 `loadMarkdownDir` 共享 helper 或容忍少量重复）
- [x] 1.5 在 `src/customize/loader.ts` 的 `loadCustomizeContext` 中调用 `loadKnowledge`，结果填入 `CustomizeContext.knowledge`

## 2. Frontmatter 解析

- [x] 2.1 在 `src/customize/knowledge.ts` 实现 frontmatter 解析（同 skills，但只提取 `name` / `description`，忽略 `whenToUse` 即使存在）
- [x] 2.2 容错：frontmatter 格式不正确 → 当作无 frontmatter，整个文件内容（含 `---` 行）作为 `content`
- [x] 2.3 从 `content` 中剥离 frontmatter 块

## 3. 文件读取与边界处理

- [x] 3.1 用 UTF-8 强制读取，剥离 UTF-8 BOM
- [x] 3.2 单文件读失败：warning 日志 + 跳过该文件，继续加载其他文件
- [x] 3.3 `knowledge/` 目录不存在：返回空数组，不报错
- [x] 3.4 `knowledge/` 目录存在但为空：返回空数组
- [x] 3.5 非 `.md` 文件忽略；子目录不递归

## 4. 系统提示词组装扩展

- [x] 4.1 修改 `src/agent/bridge-system-prompt.ts` 的 `buildBridgeSystemPrompt`：在 `<skills>` 块之后追加 `<knowledge_base>` 块
- [x] 4.2 `<knowledge_base>` 块格式：
  ```
  <knowledge_base>
  <knowledge name="fault-dictionary">[content]</knowledge>
  <knowledge name="sn-port-mapping">[content]</knowledge>
  </knowledge_base>
  ```
- [x] 4.3 `knowledge` 为空数组时也注入空块 `<knowledge_base></knowledge_base>`
- [x] 4.4 当 `customize` 整体为 `undefined` 时，不注入 `<knowledge_base>` 块（保持向后兼容）

## 5. Config 卡片扩展

- [x] 5.1 在 `src/card/config-card.ts` 增加 "知识库" 折叠面板，位于 "技能清单" 面板下方
- [x] 5.2 在 `ConfigFormOpts` 增加 `knowledge: Array<{ name: string; description?: string; charCount: number; sourceFile: string }>` 字段
- [x] 5.3 面板内容：每个知识文件一行 `- {name} ({description}, {charCount} 字符)` 或 `- {name} ({charCount} 字符)`（无 description 时）
- [x] 5.4 面板底部显示总字符数 `总计: {sum} 字符`
- [x] 5.5 空时显示 "_创建 customize/knowledge/*.md 以激活知识库注入_"，无总字符数行
- [x] 5.6 在 `src/commands/index.ts` 处理 `/config` 命令时从 `CustomizeContext.knowledge` 填充 `ConfigFormOpts.knowledge`

## 6. 单元测试

- [x] 6.1 创建 `tests/unit/customize/knowledge.test.ts`：
  - 多文件加载 + 字典序
  - 非 `.md` 文件忽略
  - 子目录不递归
  - 空目录 / 缺失目录
- [x] 6.2 frontmatter 解析测试：
  - 完整 frontmatter（name/description）
  - 无 frontmatter（用文件名 stem）
  - frontmatter 含 whenToUse（被忽略）
  - 畸形 frontmatter 降级处理
- [x] 6.3 文件读取边界测试：
  - BOM 剥离
  - 单文件读失败不影响其他文件
  - markdown 表格/代码块结构保留
- [x] 6.4 扩展 `tests/unit/agent/bridge-system-prompt.test.ts`：
  - 有 knowledge + 有 skills + 有 persona
  - 有 knowledge + 无 skills + 无 persona
  - 空 knowledge 数组（注入空块）
  - customize undefined（不注入 knowledge 块）
- [x] 6.5 扩展 `tests/unit/customize/loader.test.ts`：
  - persona + skills + knowledge 三者同时加载
  - 三者任意组合的缺失情况
  - customize disabled 时 knowledge 也为空
  - CustomizeContext 完整 shape 验证

## 7. 集成验证

- [x] 7.1 跑 `pnpm test` 全套测试通过（105 tests passed）
- [x] 7.2 跑 `pnpm typecheck` 类型检查通过（tsc --noEmit PASS）
- [ ] 7.3 手动验证：在 `~/.lark-channel/profiles/<profile>/customize/knowledge/` 创建两个测试知识文件（含 frontmatter），`@bot` 触发，通过 `/doctor` 或日志确认 `<knowledge_base>` 块注入
- [ ] 7.4 手动验证：删除 `knowledge/` 目录，确认 `<knowledge_base></knowledge_base>` 空块仍注入
- [ ] 7.5 手动验证：`/config` 卡片 "知识库" 面板正确显示，包含总字符数
- [ ] 7.6 手动验证：三个定制层（persona + skills + knowledge）同时激活时系统提示词结构完整：BRIDGE → persona → skills → knowledge_base
