// 生成系统提示词文件，用 claude -p 测试是否加载 skills 和 SOUL.md
import { loadCustomizeContext } from './src/customize/loader.ts';
import { buildBridgeSystemPrompt } from './src/agent/bridge-system-prompt.ts';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ctx = await loadCustomizeContext({
  profileDir: 'C:\\Users\\spirit-ai\\.lark-channel\\profiles\\claude',
  customizeConfig: { enabled: true, dir: 'd:\\ai\\robot\\hwato-customize' },
});

const prompt = buildBridgeSystemPrompt(undefined, ctx);
const dir = mkdtempSync(join(tmpdir(), 'lark-claude-test-'));
const promptFile = join(dir, 'append-system-prompt.md');
writeFileSync(promptFile, prompt, 'utf8');

console.log('系统提示词文件:', promptFile);
console.log('系统提示词长度:', prompt.length);
console.log('包含 udas16.152:', prompt.includes('udas16.152'));
console.log('包含 ssh-skill:', prompt.includes('ssh-skill'));
console.log('\n现在请运行:');
console.log(`claude -p --output-format stream-json --verbose --append-system-prompt-file "${promptFile}" -i`);
