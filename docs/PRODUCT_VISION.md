# 产品愿景：让 NPC 去上班

## 参赛信息

- 参赛人员：小汤圆
- 小组：回家玩游戏！！
- 项目：DSH AGH Work Orchestrator

## 我们相信什么

我们认为，随着 AI 生产力持续增长，人会把更多时间从重复劳动转向目标判断、创作、娱乐和文化体验。这个判断是一项产品愿景，不是对就业时间表的预测。

今天的 AI 办公产品通常要求人停下正在做的事，进入另一个聊天框、任务面板或文档页面持续盯进度。我们想反过来：把 AI、办公工具和持久工作会话接入游戏 NPC，让工作界面退到游戏背后。

玩家负责说清楚目标、判断方向和给出反馈；AI 负责检索、写作、制作文件和执行耗时步骤。玩家不需要离开游戏，也不需要等待长任务完成。

交互入口不是打字聊天框。玩家主要通过游戏内语音向 NPC 交代、追问和修改工作，也可以用“小皮鞭”这一游戏动作表达催办；NPC 通过语音和角色头顶气泡快速回应。文字转写可以作为后台识别数据，但不是玩家需要操作的办公界面。

## 典型体验

1. 玩家在游戏里说：“小汤圆，帮我做一份 AI 对游戏行业影响的汇报。”
2. 小汤圆先完成当前回复：“好，已经安排工作会话处理，你继续玩。”
3. 回答结束后，Work Orchestrator 才识别这是工作请求，并创建独立 Worker DSH Session。
4. Worker 使用 DSH 中已有的研究、写作、文件或 Codex 能力执行工作。
5. 小汤圆把思路、进度或成果主动带回游戏。
6. 玩家说“第二部分不对”，反馈继续进入原 Worker Session，而不是新开一个任务。
7. 最终成果保存在 Worker Session 对应的 Workspace；玩家可以打开文件，也可以在 DSH Session 列表查看完整记录。

## 产品边界

本项目只增加一层很薄的 Session 协调：

- 回答后识别工作意图；
- 创建或恢复原生 Worker DSH Session；
- 保存 companion Session 与 Worker Session 的关联；
- 把公开回答交回陪伴角色和产品界面。

本项目不创建 WorkTask 数据库、任务中心、进度百分比或第二套任务状态机。DSH Session 是工作记录的事实来源，Workspace 是成果来源。

## 生产力工具生态

Worker Session 会根据任务使用运行环境中已安装并向它暴露的工具。DeepSeek Harness 是持久会话和编排底座；其官方 subagent 能力包含真实 Codex app-server Provider 与通过官方 Claude Agent SDK 运行的 Claude Code Provider。两者都需要部署方单独完成安装、认证、权限配置和启用，Work Orchestrator 不会替它们伪造登录或静默降级。

腾讯 `WorkBuddy` 是面向办公、代码与设计场景的 AI 办公工作台。宣传页将它列为待接入的外部能力；这表示产品方向已确认，不表示本仓库已经替用户完成安装、登录、文件授权或协议适配。

## 多游戏边界

Work Orchestrator 不依赖某个 NPC 名称或某款游戏。星露谷物语、缺氧、饥荒联机版等游戏分别通过自己的 AGH Game Adapter 提交语音/动作事件并接收通知，后台编排逻辑复用。新增一款游戏仍然需要实现和验证该游戏的 Adapter；“支持多游戏”不表示任意游戏可以零配置自动接入。

### 星露谷候选实现

当前上游星露谷 `0.8.2` 候选实现已经把“陪伴”和“干活”落到同一个角色上：小汤圆可以通过标准 Adapter 执行播种、浇水、收割、催熟、清障、起飞、降落、钓鱼协助、矿洞战斗和深夜救援，也有 HUD、语音气泡、成长记录与每日陪伴日记。

五个固定教学条目只负责教会角色技能并记录成长，不接管主剧情。跨游戏剧情仍由 Harness Story Runtime 负责；Work Orchestrator 仍只负责回答后的工作识别、Session 连接和公开进度回传。

日记记录当天去过的地点、聊天次数、互动、金币变化和心愿结果，晚上 22:00 后或一天结束时生成。它随星露谷存档保存，AI 生成失败时写入基于真实事件的本地兜底文本。以上目前属于候选实现能力，不能替代真实游戏内回归。

## 联网资料依据

- [DeepSeek Harness Session 数据平面](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/session/README.md)：官方说明 Session 对话可持久化，并在恢复时重放事件日志。
- [DeepSeek Harness Python SDK 指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/python-sdk.md)：官方建议独立工作使用新 Session ID，继续同一上下文时复用原 ID。
- [DeepSeek Harness Workspace UI](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-workspace/README.md)：官方客户端已支持在侧栏浏览和管理 Workspace 与 Session。
- [DeepSeek Harness Subagent 能力族](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/subagent/README.md)：官方列出 Codex 与 Claude Code Provider，可以把独立任务交给真实外部产品执行。
- [腾讯 WorkBuddy](https://cloud.tencent.com.cn/product/workbuddy)：腾讯官方将其定义为覆盖日常办公、代码开发与设计创意的全场景 AI 办公工作台。
- [NBER Working Paper 31161: Generative AI at Work](https://www.nber.org/papers/w31161)：对 5,179 名客服人员的研究显示，AI 助手使每小时解决问题数平均提高 14%。该结果来自特定企业和工作场景，只用于说明人机协作可能提高产出，不代表所有职业或本产品已经达到相同效果。

## 当前验证边界

仓库当前自动化验证覆盖插件构建，以及配置、回答后识别、同 Session 复用、重启恢复和旧关联迁移。宣传页是可运行的静态产品展示。真实语音、真实模型、完整 Desktop 通知和最终办公成果仍应通过端到端演示单独验证，不能由单元测试替代。
