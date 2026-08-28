# 架构

```text
玩家文字或语音
      |
      v
小汤圆 DSH Session ---- 立即完成本轮简短回复
      |
      | 回答结束后
      v
WorkSessionService
  |-- 保守识别 none/start/continue/inspect
  |-- 记录 companionSessionId -> workerSessionId
  |-- 通过 DSH Agent API 创建或继续 Worker Session
  `-- 把 Worker 公开回答转回小汤圆
      |
      v
独立 Worker DSH Session ---- 研究、写作、HTML、代码与成果文件
```

## 不拥有的状态

协调层不保存任务百分比、任务生命周期或独立工作记录。DSH Session 是工作事实来源，Workspace 是成果来源。协调层只保存“哪个小汤圆 Session 当前关联哪个 Worker Session”这一条关系。

## 回答后识别

工作识别必须发生在小汤圆回复完成之后。普通聊天和游戏技能继续走原链路；只有明确的通用工作请求才创建 Worker。含糊输入默认 `none`，避免把游戏动作误送到外部工作会话。
