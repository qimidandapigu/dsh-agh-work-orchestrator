# DSH AGH Work Orchestrator

`dsh-agh-work-orchestrator` 是从 AI Native Game Harness（AGH）中独立出来的通用 DSH 工作编排插件。它让陪伴角色先完成当前对话回复；回复结束后，后台识别器再判断用户是否提出了需要长期处理的通用工作。命中后，插件创建或恢复一个独立 Worker DSH Session，并把公开更新交回原陪伴 Session。

`AGH` 是 `AI Native Game Harness` 的缩写。GitHub 仓库使用 AGH 品牌名，运行时包名保持为 `@qimidandapigu/dsh-work-orchestrator`，便于其他角色和产品复用。

本项目不建立任务中心，不创建 WorkTask 数据库，也不维护第二套任务状态机。工作事实、对话记录和成果仍由 DSH Session 与其 Workspace 保存。

当前版本：`0.1.7`。本仓库发布的是 Git 源码版本；尚未声明已经发布到 npm。

## 产品宣传页

![玩家在游戏里通过语音催 NPC 完成 PPT](site/assets/npc-work-hero.png)

- 公网体验：[https://qimidandapigu.github.io/dsh-agh-work-orchestrator/](https://qimidandapigu.github.io/dsh-agh-work-orchestrator/)
- 本地 HTML：[site/index.html](site/index.html)
- 本地预览：`http://127.0.0.1:4173/?version=0.1.7`

- 参赛人员：**小汤圆**
- 小组：**回家玩游戏！！**

我们相信，未来的人不该被工作界面困住。玩家继续玩游戏，通过语音向 NPC 说明目标；NPC 连接 AI 与办公工具，在独立 Worker DSH Session 中持续完成工作、主动汇报，并把最终成果保存在 Workspace。

核心交互是**游戏内语音 + 小皮鞭动作**，不是打字聊天框：玩家按住说话交代任务，用小皮鞭催办，NPC 通过语音和头顶气泡回应。

宣传页默认展示鞭子盘在玩家手中、尚未出手的平静画面；点击首页大图、下方游戏画面或“演示语音 + 小皮鞭”后，切换为 NPC 惊讶回应画面，5 秒后自动恢复，适合现场反复演示。画面标签明确标出左侧玩家与右侧 AI NPC 小汤圆。

同一通用编排层可以通过游戏 Adapter 服务星露谷物语、缺氧、饥荒联机版等不同游戏。Worker Session 会优先使用 DSH 中已经安装并启用的生产力工具；DSH 官方提供 Claude Code 与 Codex subagent Provider，外部产品仍需在部署环境中单独安装和认证。

### 最新游戏接入进展

上游 AI Native Game Harness 已形成星露谷 `0.8.2` 候选实现：包含播种、浇水、收割、催熟、清障、起飞、降落、钓鱼协助、矿洞战斗和深夜救援十项标准动作，以及 HUD、语音气泡、技能教学、成长记录和每日陪伴日记。日记会根据当天真实游戏事件生成并随存档保存，生成不可用时保留本地兜底内容。

这部分属于游戏 Adapter 与表现层，不属于本仓库的 Work Orchestrator 核心。当前证据是 Windows 编译和自动测试通过；真实存档中的动作、语音、动画与长时间稳定性仍需逐项游戏内回归，宣传页不会把候选实现写成已经完成的正式发布。

直接打开 [site/index.html](site/index.html) 查看完整中文产品宣传页。本地预览：

```powershell
python -m http.server 4173 --directory site
```

`main` 分支中的 `site/` 发生变化后，[GitHub Pages 工作流](.github/workflows/pages.yml)会自动发布公网版本。首次打开时需要下载多张高分辨率演示图，加载可能需要几秒。

产品定位、用户旅程和事实依据见 [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md)。

Vibe Hacks #05 表单可复制内容和截图清单见 [docs/VIBE_HACKS_05_SUBMISSION.md](docs/VIBE_HACKS_05_SUBMISSION.md)。

## 为什么单独建仓库

本仓库在 2026 年 8 月 28 日 18:00（Asia/Shanghai）之后建立，用于实现一个有明确边界的新创意。既有 AI Native Game Harness 是公开、可追溯的上游基础，不会伪装成本项目的新代码。完整边界见 [UPSTREAM_BASE.md](UPSTREAM_BASE.md)。

## 当前已经实现

- 陪伴角色回答完成后再做工作意图识别，不阻塞首字和语音回复。
- `start`、`continue`、`inspect` 与保守的 `none` 四类意图。
- 一个陪伴 Session 关联并复用同一个 Worker DSH Session。
- 只持久化 Session 关联，不保存第二份任务内容或状态。
- 重启后恢复原 Worker Session；恢复失败时保留关联并明确报告，不静默新建任务。
- Worker 的公开回复回传给原陪伴 Session，再由调用方配置的角色身份汇报。
- 兼容旧的 `xiaotangyuan-work-*` Session 与关联文件。
- 关闭服务时等待后台识别任务并释放 Worker Session。
- 通过 Cordis patch 作为独立 DSH 插件安装。

## 本地验证

要求 Node.js 22.19+ 与 pnpm 10.28.2：

```powershell
pnpm install --frozen-lockfile
pnpm check
```

## 接入方式

在 DSH Runtime 中安装本包并应用 `cordis.patch.yml`。调用方注入 `workOrchestrator` 服务，只在陪伴角色公开回复结束后调用 `scheduleTurn()`，并传入角色资料与通知回调。

最重要的时序要求是：先把陪伴角色当前回复交给用户，再调用 `scheduleTurn()`。该方法只入队后台识别并立即返回，不应阻塞当前回复。

```ts
ctx.workOrchestrator.scheduleTurn({
  companionSessionId,
  playerText,
  companionReply,
  selection,
  source: 'voice',
  companion: {
    id: 'xiaotangyuan',
    name: '小汤圆',
  },
  notify: update => sendWorkUpdateToClient(update),
})
```

完整配置和调用契约见 [docs/INTEGRATION.md](docs/INTEGRATION.md)，架构与恢复行为见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，AI Native Game Harness 的薄接线边界见 [integration/README.md](integration/README.md)。

## 验证边界

`pnpm check` 当前覆盖 TypeScript 构建与 4 个本地测试：配置约束、回答后识别与同 Session 复用、重启恢复、旧小汤圆关联迁移。它不等同于真实模型、真实语音、Desktop 通知或最终 HTML 产出的端到端验证。

版本变化见 [CHANGELOG.md](CHANGELOG.md)。

## License

MIT
