# 架构

```text
玩家文字或语音
      |
      v
陪伴角色 DSH Session -- 立即完成本轮简短回复
      |
      | 回答结束后
      v
WorkOrchestratorService
  |-- 保守识别 none/start/continue/inspect
  |-- 持久化 companionSessionId -> workerSessionId
  |-- 通过 DSH Agent API 创建或恢复 Worker Session
  `-- 把 Worker 公开回答转回原陪伴 Session
      |
      v
独立 Worker DSH Session ---- 研究、写作、HTML、代码与成果文件
```

## 不拥有的状态

协调层不保存任务百分比、任务生命周期或独立工作记录。DSH Session 是工作事实来源，Workspace 是成果来源。协调层只保存“哪个陪伴 Session 当前关联哪个 Worker Session”这一条关系。

## 回答后识别

工作识别必须发生在陪伴角色回复完成之后。普通聊天和游戏技能继续走原链路；只有明确的通用工作请求才创建 Worker。含糊输入默认 `none`，避免把游戏动作误送到外部工作会话。

## 恢复与兼容

插件把关联写入 `work-session-links-v1.json`，其中只有 Session ID、标题、模型选择、可用状态和更新时间。重启时通过 DSH `agents.resume` 恢复原 Session。旧的 `xiaotangyuan-work-*` 前缀和旧数据目录仍可迁移读取。

恢复失败时，插件把关联标记为 `unavailable`，并向陪伴角色报告原 Worker Session 暂时无法恢复。它不会静默创建一个新 Session，否则玩家的修改意见可能进入错误的上下文。

## 一轮工作的生命周期

```text
陪伴回复已经公开
  -> scheduleTurn() 立即入队并返回
  -> 模型识别 none/start/continue/inspect
  -> start: 创建新的原生 Worker DSH Session
  -> continue: 恢复或复用已关联 Worker Session
  -> inspect: 读取当前 Worker 的真实公开回答或运行状态
  -> Worker 公开回答
  -> 原陪伴 Session 按自己的角色口吻转述
  -> notify() 把更新交给游戏或 Desktop
```

新 `start` 会替换当前陪伴 Session 的活动关联；`continue` 和 `inspect` 不会另开 Worker。所有后台运行按同一 Worker 的队列串行化，避免同一会话的两条修改并发覆盖。
