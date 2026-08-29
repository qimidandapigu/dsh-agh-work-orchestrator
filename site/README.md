# 产品宣传页

这是 `dsh-agh-work-orchestrator` 的静态中文产品介绍页，使用用户提供的概念演示图作为主视觉。

页面坚持“游戏内语音 + 小皮鞭动作”的交互设定，不把产品表现成文字聊天工具。工作记录虽然由 DSH Session 保存，但玩家看到的是游戏角色、语音和头顶气泡。

产品生态区展示 DSH 作为工作底座、Claude Code/Codex 官方 Provider 的可配置接入，以及面向星露谷物语、缺氧、饥荒联机版的多游戏 Adapter 结构。外部生产力工具必须实际安装并启用；新增游戏也必须实现自己的 Adapter。

直接双击 `index.html` 即可浏览；也可以在仓库根目录启动本地服务器：

```powershell
python -m http.server 4173 --directory site
```

然后打开 `http://127.0.0.1:4173/`。

页面引用的外部资料：

- [DeepSeek Harness Session 数据平面](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/session/README.md)
- [DeepSeek Harness Workspace UI](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-workspace/README.md)
- [NBER: Generative AI at Work](https://www.nber.org/papers/w31161)

NBER 的 14% 数据来自 5,179 名客服人员的特定场景研究，页面已明确标注其适用边界，不将其泛化为所有职业。
