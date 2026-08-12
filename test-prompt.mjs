// 直接用源码验证 - 通过 tsx 运行
import { loadCustomizeContext } from './src/customize/loader.ts';
import { buildBridgeSystemPrompt } from './src/agent/bridge-system-prompt.ts';

const ctx = await loadCustomizeContext({
  profileDir: 'C:\\Users\\spirit-ai\\.lark-channel\\profiles\\claude',
  customizeConfig: { enabled: true, dir: 'd:\\ai\\robot\\hwato-customize' },
});

console.log('=== customize 加载结果 ===');
console.log('hasPersona:', Boolean(ctx.persona));
console.log('persona charCount:', ctx.persona?.charCount);
console.log('skills count:', ctx.skills.length);
console.log('knowledge count:', ctx.knowledge.length);

if (ctx.persona) {
  console.log('\n=== persona 是否包含 udas16.152 ===', ctx.persona.content.includes('udas16.152'));
  console.log('=== persona 是否包含 spiritUDAS2024 ===', ctx.persona.content.includes('spiritUDAS2024'));
  console.log('=== persona 是否包含 ssh-skill ===', ctx.persona.content.includes('ssh-skill'));
  console.log('=== persona 是否包含 ssh_execute.py ===', ctx.persona.content.includes('ssh_execute.py'));
}

const prompt = buildBridgeSystemPrompt(undefined, ctx);
console.log('\n=== 完整系统提示词长度 ===', prompt.length);
console.log('\n=== 系统提示词是否包含 persona 块 ===', prompt.includes('<persona>'));
console.log('=== 系统提示词是否包含 udas16.152 ===', prompt.includes('udas16.152'));
console.log('=== 系统提示词是否包含 spiritUDAS2024 ===', prompt.includes('spiritUDAS2024'));

console.log('\n=== persona 块内容 ===');
const m = prompt.match(/<persona>([\s\S]*?)<\/persona>/);
if (m) console.log(m[1]);
