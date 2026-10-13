# M4：v0.8.0

- 日期：2026-10-13
- 状态：已发布并保留
- 规则版本：`hangzhou-v5-streamlined-board`
- 用户验收：`0f85364fd783b62610763a6970d1d14fa5cddab1` 的 375×667 / 390×844 双尺寸截图已验收
- 发布源码：`72fb273e3bfe65d2c94fa8ecfd72f9963d1f1418`
- 生产 release：`/opt/hangzhou-partners/releases/v0.8.0-20261013T075801Z`
- 回滚点：`/opt/hangzhou-partners/releases/v0.7.3-20261012T031241Z`

## 发布工件

- 从锁定源码提交构建，排除 `.git`、`node_modules`、`screenshots`、`artifacts` 与历史 `*.tar.gz`
- 成员数：95
- SHA256：`509dbb231d346c5a75ad757adf955e41959eab2f9a09076dd894a8a31cf4aead`
- 生产依赖：`ws@8.22.0`；共享 `data` 使用绝对链接 `/opt/hangzhou-partners/data`

## 主要变化

- 移除板块进度、分档增益和相关得分；项目类别仅作说明
- 精简短屏对局面，移除底部控制栏与动态栏，工具入口上移
- 当前玩家在棋盘中央使用同一 WebGL 骰子的静止态和投掷态；骰子与“点击投掷”均可触发同一权威命令
- 放大格子文字与图案、减细边框；三级建设不再受类别数量门槛限制，倍率同步校准

## 验证证据

- Fresh `npm ci --ignore-scripts` 后 `npm run verify`：PASS；40/40、390×844 E2E、M1 200 局与 M4 1000 局固定种子门禁全过
- 切换后：current/version/cache 均为 v0.8.0；服务 active；本机与公网 health 均为 200
- 核心烟测房 `806025`：创建、第二真人进入、双 Bot、开局、点击投掷、`DICE_ROLLED`、`PLAYER_MOVED`、`TURN_STARTED` 与结束均通过；round 1→2、game version 2→6，最终 `finished`
- SQLite：`PRAGMA quick_check=ok`；共享 DB device:inode=`64771:2112440`
- v0.7.3 回滚目录存在且 package version=0.7.3
- 服务重启后的第一次本机 health 探针处于启动窗口而连接失败；等待循环中的后续探针及最终内外 health 均稳定为 200，未触发回滚
