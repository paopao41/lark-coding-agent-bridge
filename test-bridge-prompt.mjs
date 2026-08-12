// 用 bridge 格式的 prompt 测试 claude
import { loadCustomizeContext } from './src/customize/loader.ts';
import { buildBridgeSystemPrompt } from './src/agent/bridge-system-prompt.ts';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ctx = await loadCustomizeContext({
  profileDir: 'C:\\Users\\spirit-ai\\.lark-channel\\profiles\\claude',
  customizeConfig: { enabled: true, dir: 'd:\\ai\\robot\\hwato-customize' },
});

const systemPrompt = buildBridgeSystemPrompt(undefined, ctx);
const dir = mkdtempSync(join(tmpdir(), 'lark-claude-test2-'));
const promptFile = join(dir, 'append-system-prompt.md');
writeFileSync(promptFile, systemPrompt, 'utf8');

// 模拟 bridge 的 prompt 格式
const bridgePrompt = `<bridge_context>
{"chatId":"oc_test","chatType":"p2p","senderId":"ou_test","senderName":"Poppy Guo","senderType":"user","botOpenId":"ou_bot","source":"im"}
</bridge_context>

<user_input>
{"text":"查看udas16.152设备相机内参"}
</user_input>`;

console.log('系统提示词文件:', promptFile);
console.log('用户 prompt:', bridgePrompt);
console.log('\n现在请运行:');
console.log(`echo '${bridgePrompt.replace(/'/g, "''")}' | claude -p --output-format stream-json --verbose --permission-mode bypassPermissions --append-system-prompt-file "${promptFile}"`);
