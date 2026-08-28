# 从 AG-harness 工作区迁移的代码

本仓库首批实现来自 `C:\game\ai-native-game-harness` 的未提交 Work Session 开发。原工作区没有被重置、清理或提交。

| 原位置 | 新位置 | 处理方式 |
| --- | --- | --- |
| `plugins/xiaotangyuan-game/src/runtime/work/work-session-service.ts` | `src/work-session-service.ts` | 迁移核心协调服务，改为独立包身份 |
| `plugins/xiaotangyuan-game/test/work-session.test.ts` | `test/work-session.test.ts` | 迁移回答后识别与 Session 复用测试 |
| 原插件、Gateway、Desktop 的接线改动 | 暂留上游工作区 | 后续整理成薄集成补丁，不复制整套旧项目 |
| 网站截图与旧游戏文档改动 | 不迁移 | 与本次新创意无关 |

迁移目标是把新能力做成可独立测试和迭代的 DSH 组件，而不是把旧仓库重新打包。
