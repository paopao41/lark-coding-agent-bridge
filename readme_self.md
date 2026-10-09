```
# 编译 & 服务相关启动
cd ~/robot/lark-coding-agent-bridge
pnpm install   # 依赖未安装时
pnpm build     # = vite build web + tsup，产物输出到 dist/

# 启动claude profile模式
node bin/lark-channel-bridge.mjs run --profile claude
```

