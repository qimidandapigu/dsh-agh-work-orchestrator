# 产品愿景：让 NPC 去上班

## 参赛信息

- 参赛人员：小汤圆
- 小组：回家玩游戏！！
- 项目：DSH AGH Work Orchestrator

## 我们相信什么

我们认为，随着 AI 生产力持续增长，人会把更多时间从重复劳动转向目标判断、创作、娱乐和文化体验。这个判断是一项产品愿景，不是对就业时间表的预测。

今天的 AI 办公产品通常要求人停下正在做的事，进入另一个聊天框、任务面板或文档页面持续盯进度。我们想反过来：把 AI、办公工具和持久工作会话接入游戏 NPC，让工作界面退到游戏背后。

玩家负责说清楚目标、判断方向和给出反馈；AI 负责检索、写作、制作文件和执行耗时步骤。玩家不需要离开游戏，也不需要等待长任务完成。

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

## 联网资料依据

- [DeepSeek Harness Session 数据平面](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/session/README.md)：官方说明 Session 对话可持久化，并在恢复时重放事件日志。
- [DeepSeek Harness Python SDK 指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/python-sdk.md)：官方建议独立工作使用新 Session ID，继续同一上下文时复用原 ID。
- [DeepSeek Harness Workspace UI](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-workspace/README.md)：官方客户端已支持在侧栏浏览和管理 Workspace 与 Session。
- [NBER Working Paper 31161: Generative AI at Work](https://www.nber.org/papers/w31161)：对 5,179 名客服人员的研究显示，AI 助手使每小时解决问题数平均提高 14%。该结果来自特定企业和工作场景，只用于说明人机协作可能提高产出，不代表所有职业或本产品已经达到相同效果。

## 当前验证边界

仓库当前自动化验证覆盖插件构建，以及配置、回答后识别、同 Session 复用、重启恢复和旧关联迁移。宣传页是可运行的静态产品展示。真实语音、真实模型、完整 Desktop 通知和最终办公成果仍应通过端到端演示单独验证，不能由单元测试替代。
