# 配置与调用契约

## DSH 插件安装

包内的 `cordis.patch.yml` 提供默认安装项：

```yaml
- insert:
    - id: work-orchestrator
      name: '@qimidandapigu/dsh-work-orchestrator'
      config:
        enabled: true
        provider: zai
        model: glm-5.2
        reasoningEffort: off
```

默认模型只是当前 AGH 集成配置，不是插件强制要求。调用方也可以不设置 `provider` 和 `model`，让 Worker 沿用本轮陪伴 Session 传入的模型选择。

## 配置字段

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 是否启用回答后的工作识别。 |
| `provider` | string | 未设置 | Worker 与识别模型 Provider；必须与 `model` 同时设置。 |
| `model` | string | 未设置 | Worker 与识别模型；必须与 `provider` 同时设置。 |
| `reasoningEffort` | string | 未设置 | 仅在已配置 `provider` 和 `model` 时有效。 |
| `directory` | absolute path | `%LOCALAPPDATA%/AI Native Game Harness/work-orchestrator` | 只保存 companion-to-Worker 关联索引。相对路径会被拒绝。 |

## `scheduleTurn()` 输入

调用必须发生在陪伴角色当前公开回复结束之后。方法返回 `void`，识别与 Worker 执行在内部后台队列继续。

必要字段：

- `companionSessionId`：发起工作的原 DSH Session ID。
- `playerText`：玩家本轮原始输入。
- `companionReply`：已经公开给玩家的最终回复，用于识别上下文，不会被插件改写。
- `selection`：未固定插件模型时使用的 DSH 模型选择。
- `source`：调用来源标识，例如 `voice`、`chat` 或 `desktop`。

可选字段：

- `companion`：调用角色的稳定 ID、显示名称、Worker 补充约束和转述约束。
- `notify`：把最终转述或错误通知交回产品层的回调。

## 通知输出

`notify` 收到：

- `workSessionId`：真实 Worker DSH Session ID；没有关联时可能为空。
- `title`：工作标题。
- `text`：Worker 公开回答，或经原陪伴 Session 转述后的文本。
- `kind`：`update`、`status` 或 `error`。
- `source`：原调用来源，便于 Gateway/Desktop 路由。

## 运行与关闭

产品运行时关闭前调用 `close()`。它会等待已经入队的识别任务结束，再释放当前进程持有的 Worker Agent handle；DSH 自身仍负责 Session 对话与 Workspace 的持久化。

测试或受控关机流程可以先调用 `flush()`，只等待后台任务完成而不关闭服务。
