# 从 AI Native Game Harness 工作区迁移的代码

本仓库首批实现来自 `C:\game\ai-native-game-harness` 的未提交 Work Session 开发。之后该实现已在原工作区拆成独立插件，本仓库现在同步这份通用插件代码。原工作区没有被重置、清理或提交。

| 原位置 | 新位置 | 处理方式 |
| --- | --- | --- |
| `plugins/dsh-work-orchestrator/src/` | `src/` | 同步通用协调服务、配置和持久关联存储 |
| `plugins/dsh-work-orchestrator/test/` | `test/` | 同步回答后识别、Session 复用、恢复和旧数据迁移测试 |
| `plugins/dsh-work-orchestrator/cordis.patch.yml` | `cordis.patch.yml` | 保留独立 DSH 插件安装入口 |
| Gateway、Desktop 与小汤圆的调用接线 | 暂留上游工作区 | 只记录薄集成边界，不复制整套旧项目 |
| 网站截图与旧游戏文档改动 | 不迁移 | 与本次新创意无关 |

迁移目标是把新能力做成可独立测试和迭代的 DSH 组件，而不是把旧仓库重新打包。
