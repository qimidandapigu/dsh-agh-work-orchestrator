# AI Native Game Harness 集成边界

上游只需要四个薄接点：

1. 启动时创建 `WorkSessionService`。
2. 小汤圆公开回复完成后调用 `scheduleTurn()`。
3. Gateway 或 Desktop 接收 `WorkNotification` 并展示或播报。
4. 运行时关闭时调用 `close()`。

上游当前未提交工作区已经包含一版接线。待独立包接口稳定后，再把接线整理为可审阅的小补丁；本仓库不会复制上游桌面应用、游戏 Adapter、网站或历史提交。
