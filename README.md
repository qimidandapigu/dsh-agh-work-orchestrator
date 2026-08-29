# DSH AGH Work Orchestrator

`dsh-agh-work-orchestrator` 是从 AI Native Game Harness（AGH）中独立出来的通用 DSH 工作编排插件。它让陪伴角色先完成当前对话回复；回复结束后，后台识别器再判断用户是否提出了需要长期处理的通用工作。命中后，插件创建或恢复一个独立 Worker DSH Session，并把公开更新交回原陪伴 Session。

`AGH` 是 `AI Native Game Harness` 的缩写。GitHub 仓库使用 AGH 品牌名，运行时包名保持为 `@qimidandapigu/dsh-work-orchestrator`，便于其他角色和产品复用。

本项目不建立任务中心，不创建 WorkTask 数据库，也不维护第二套任务状态机。工作事实、对话记录和成果仍由 DSH Session 与其 Workspace 保存。

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

AI Native Game Harness 的接线边界见 [integration/README.md](integration/README.md)，设计说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## License

MIT
