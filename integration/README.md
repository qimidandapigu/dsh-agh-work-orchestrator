# AI Native Game Harness 集成边界

上游只需要四个薄接点：

1. 由 DSH Cordis patch 安装 `@qimidandapigu/dsh-work-orchestrator`。
2. 小汤圆公开回复完成后，通过注入的 `workOrchestrator` 调用 `scheduleTurn()`。
3. Gateway 或 Desktop 接收 `WorkNotification` 并展示或播报。
4. 运行时关闭时调用 `close()`。

上游当前未提交工作区已经包含这版接线。本仓库只发布通用插件；不会复制上游桌面应用、游戏 Adapter、网站或历史提交。
