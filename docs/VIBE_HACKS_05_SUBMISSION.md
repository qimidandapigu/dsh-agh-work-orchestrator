# Vibe Hacks #05 提交材料

## 项目名称

别上班，让 NPC 去上班

## 项目介绍（Markdown，可直接复制）

```markdown
# 别上班，让 NPC 去上班

**参赛人员：小汤圆**  
**小组：回家玩游戏！！**

未来的人不该被工作界面困住。你继续种田、钓鱼、探险，把工作要求直接说给游戏里的 AI NPC；NPC 会调用成熟生产力工具持续干活，并在游戏里主动向你汇报。

## 核心体验

- 不用打开办公软件或文字聊天框，直接在游戏里用语音交代工作。
- 可以挥动“小皮鞭”催办；NPC 会惊讶回应并继续处理。
- 耗时工作不会卡住陪伴对话，NPC 仍能随时和玩家交流。
- 玩家可以询问进度、继续修改原需求，并最终查看生成的成果。

## 它怎么工作

小汤圆负责陪伴、沟通和汇报；独立的 DeepSeek Harness Session 负责持续产出。`dsh-agh-work-orchestrator` 在回答结束后识别工作意图，创建或恢复原工作 Session，并把后续反馈继续送回同一上下文。成果保存在对应 Workspace，不额外发明任务中心、WorkTask 数据库或第二套状态机。

## 工具与游戏

工作 Session 可以使用运行环境中已经安装并启用的 DeepSeek Harness、Claude Code、Codex、WorkBuddy 等生产力能力。游戏侧通过 AGH Adapter 对接，面向星露谷物语、缺氧、饥荒联机版等不同游戏复用同一套工作编排。

一句话概括：**玩家负责玩，NPC 负责干活。**
```

## 链接

- 网站：<https://qimidandapigu.github.io/dsh-agh-work-orchestrator/>
- GitHub：<https://github.com/qimidandapigu/dsh-agh-work-orchestrator>
- 小红书：发布笔记后补充，记得带 `#VibeHacks` 和 `#buildinpublic`

## 建议上传的 5 张截图

按以下顺序上传，第一张作为核心互动封面：

1. [挥鞭后 NPC 惊讶回应](../site/assets/npc-work-hero.png)
2. [挥鞭前的平静状态](../site/assets/voice-whip-before.png)
3. [星露谷物语 Adapter 展示](../site/assets/game-stardew-valley.jpg)
4. [缺氧 Adapter 展示](../site/assets/game-oxygen-not-included.png)
5. [饥荒联机版 Adapter 展示](../site/assets/game-dont-starve-together.png)

## 表单选项建议

- Waffo 出海变现：`有兴趣接入`
- 开发工具：`Codex`
- 使用模型：`GPT`、`DeepSeek`、`GLM`
- 其他自定义：`DeepSeek Harness`、`AI Native Game Harness`

只勾选本次实际使用过的工具；没有实际使用的 Cursor、Claude Code、VS Code 等不要为了展示而勾选。
