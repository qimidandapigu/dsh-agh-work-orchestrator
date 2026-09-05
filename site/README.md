# 产品宣传页

这是 `dsh-agh-work-orchestrator` 的静态中文产品介绍页，使用用户提供的概念演示图作为主视觉。

公网地址：[https://qimidandapigu.github.io/dsh-agh-work-orchestrator/](https://qimidandapigu.github.io/dsh-agh-work-orchestrator/)

页面坚持“游戏内语音 + 小皮鞭动作”的交互设定，不把产品表现成文字聊天工具。工作记录虽然由 DSH Session 保存，但玩家看到的是游戏角色、语音和头顶气泡。

产品生态区展示 DSH 作为工作底座、Claude Code/Codex 官方 Provider 的可配置接入，以及面向星露谷物语、缺氧、饥荒联机版的多游戏 Adapter 结构。外部生产力工具必须实际安装并启用；新增游戏也必须实现自己的 Adapter。

页面的“落地状态”区同步记录上游星露谷 `0.8.2` 候选实现：十项标准动作、技能成长和每日陪伴日记。这里明确区分“Windows 编译与自动测试通过”和“真实游戏内回归完成”，不把候选能力写成正式发布。

小皮鞭演示默认使用 `assets/voice-whip-before.png`，鞭子完整盘在玩家手中；点击首页大图或下方游戏画面后切到 `assets/voice-whip-demo.png`，5 秒后复位。两处画面都标注左侧玩家与右侧 AI NPC 小汤圆。腾讯办公工具使用正式名称 `WorkBuddy`，当前状态仍是待接入。

直接双击 `index.html` 即可浏览；也可以在仓库根目录启动本地服务器：

```powershell
python -m http.server 4173 --directory site
```

然后打开 `http://127.0.0.1:4173/`。

仓库使用 `.github/workflows/pages.yml` 自动发布：推送到 `main` 且 `site/` 有变化时，GitHub Actions 会把本目录作为静态站点上传到 GitHub Pages。页面使用相对资源路径，因此本地服务器和项目级 Pages 地址都可直接运行。

页面引用的外部资料：

- [DeepSeek Harness Subagent 能力族](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/subagent/README.md)
- [DeepSeek Harness Claude Code Provider](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/subagent/subagent-claude-code/README.md)
- [DeepSeek Harness Codex Provider](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/subagent/subagent-codex/README.md)
- [腾讯 WorkBuddy](https://cloud.tencent.com.cn/product/workbuddy)
