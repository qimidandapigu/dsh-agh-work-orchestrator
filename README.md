# 小汤圆 Work Session

小汤圆 Work Session 是一层很薄的 DSH Session 协调能力。小汤圆先完成当前对话回复；回复结束后，后台识别器才判断玩家是否提出了需要长期处理的通用工作。命中后，系统创建或继续一个独立 Worker DSH Session，并把公开更新转回小汤圆。

这个项目不建立任务中心，不创建 WorkTask 数据库，也不维护第二套任务状态机。工作事实、对话记录和成果仍由 DSH Session 与其 Workspace 保存。

## 为什么单独建仓库

本仓库在 2026 年 8 月 28 日 18:00（Asia/Shanghai）之后建立，用于实现一个有明确边界的新创意。既有 AI Native Game Harness 是公开、可追溯的上游基础，不会伪装成本项目的新代码。完整边界见 [UPSTREAM_BASE.md](UPSTREAM_BASE.md)。

## 当前已经实现

- 小汤圆回答完成后再做工作意图识别，不阻塞首字和语音回复。
- `start`、`continue`、`inspect` 与保守的 `none` 四类意图。
- 一个小汤圆 Session 关联并复用同一个 Worker DSH Session。
- Worker 的公开回复回传给小汤圆，再由小汤圆以自己的身份汇报。
- 关闭服务时等待后台识别任务并释放 Worker Session。
- 单元测试覆盖输入约束、回答后识别、独立 Session 创建和后续复用。

## 本地验证

要求 Node.js 22.19+ 与 pnpm 10.28.2：

```powershell
pnpm install --frozen-lockfile
pnpm check
```

## 下一步

1. 把 Session 关联从进程内 Map 改为最小持久映射，仍不保存任务状态。
2. 监听 Worker DSH Session 的公开事件，不依赖一轮执行同步结束。
3. 增加 Mock Worker 端到端验证：小汤圆持续聊天、修改复用原 Session、查询真实进度、最终生成 HTML。
4. 提供 AI Native Game Harness 的薄集成补丁与独立 Demo。

## License

MIT
