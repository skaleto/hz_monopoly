# M5：v0.8.1

- 日期：2026-10-16
- 状态：D4 已发布并保留，未触发回滚
- 规则版本：`hangzhou-v5-streamlined-board`（不改变 v0.8.0 玩法）
- 用户验收：`1715d39` 的 375×667 / 390×844 最终候选已验收，用户要求“先按照这样开发并发布吧”
- 发布源码：`1adcee92d9e1bf5e61da02c2eacaed1bc0debee4`；未沿用 D3 提交工件
- 生产基线：`/opt/hangzhou-partners/releases/v0.8.0-20261013T075801Z`（My Mac 已实时只读复核）
- 回滚点：精确生产 v0.8.0 release；不得用模糊版本或覆盖历史目录

## 主要变化

- 事件卡正面不再跨过背面角度，稳定阅读约 2.4 秒；金币增减使用权威 `cashChanges`、对应音效与粒子反馈
- 新增独立可开关、仅在进行中对局播放的程序化背景音乐；离页、切房、页面隐藏和终局均停止
- 骰子与“点击投掷”在小屏保持至少 15px 间距；骰子透明命中层不再出现方形 tap/active 暗块
- 四张同权玩家小卡收敛为连续玩家栏；“我”优先展示，对手完整指标可点按查看
- 顶部操作和棋盘冠层统一层级；道具/建设改为无外框“卡/建”动作项，道具数量内联显示

## 已完成的本地门禁

- `npm run verify`：PASS；40/40、390×844 E2E、M1 200 局与 M4 1000 局固定种子门禁全过
- 375×667 与 390×844 专项 E2E：PASS；0 broken images、0 console errors
- UI 量化：棋盘顶部 122px、棋盘高度 539px；玩家区小于 8px 文本为 0；我的区域与对手宽度比 1.51
- 需求包：`card-feedback-and-bgm-v1.md` 与 `mobile-game-surface-simplification-v1.md` 已记录授权、验收和停止条件

## 生产发布契约

1. 锁定并从唯一完整源码 SHA 构建全新 v0.8.1 release，不沿用旧工件，不覆盖 current 或历史 release。
2. 生产写入前复核：current 精确 v0.8.0、服务 active、内外 health 正常、共享 `data` 正确、DB `quick_check=ok`、精确 v0.8.0 回滚点存在。
3. 新 release 完成 production dependencies、共享 data 绝对链接、版本/cache 一致性后，才允许单次原子切换；启动/health 失败立即切回精确 v0.8.0。
4. 切换后验证页面与 health、创建/进入房间、补双 Bot、开局、点击投掷、移动和回合推进；复核 DB quick_check 与回滚点。
5. 任一硬门失败即停止并回滚；成功后回填本文件的完整 SHA、工件摘要、release 路径、烟测房间和 DB/回滚证据。

## D4 实时预检

- origin/main（D3 授权提交）：`14c9eca621b97c7bc6b7945c481bd83625ca6d07`；package/lock/cache 均为 0.8.1，ruleset=`hangzhou-v5-streamlined-board`
- current：`/opt/hangzhou-partners/releases/v0.8.0-20261013T075801Z`，symbolic link，version=0.8.0
- service：active，监听 `127.0.0.1:8427`；本机/public health 均为 200
- data：`/opt/hangzhou-partners/data`；DB device:inode=`64771:2112440`；`PRAGMA quick_check=ok`
- 精确 v0.8.0 回滚点存在且 version=0.8.0；releases 可用空间 `3823579136` bytes；已有 v0.8.1 release 数量为 0
- My Mac 结论：源码与生产基础设施 READY，可满足“全新 release + 单次原子切换 + 失败精确回滚”；预检阶段生产零写入

## 生产发布结果

- 结论：v0.8.1 已保留，未触发回滚；唯一原子切换时间为 `2026-10-16T05:34:50Z`
- 唯一源码：`1adcee92d9e1bf5e61da02c2eacaed1bc0debee4`
- 唯一工件：98 成员，SHA256=`0b3790167314939ac02eb77be03d9c543bb67e3ac59dd555962c1a7a876ac7a2`；排除 `.git`、`node_modules`、screenshots、artifacts、data/DB 与历史 tar
- fresh 门禁：`npm run verify -- --release` PASS；40/40、390×844 E2E、M1 200 局、M4 1000 局、17 文件可复现构建均通过
- 生产 release/current：`/opt/hangzhou-partners/releases/v0.8.1-20261016T053327Z`
- 生产依赖：仅 `ws@8.22.0`；production audit 为 0 vulnerabilities；`data` 为指向 `/opt/hangzhou-partners/data` 的绝对链接
- 版本与健康：package/lock/app、styles、dice-renderer 三个 cache key 均为 `0.8.1`；service active；本机与公网 health 均为 200
- 核心烟测房 `945372`：第二真人进入、双 Bot、开局、真人点击投掷、`DICE_ROLLED`、`PLAYER_MOVED`、`TURN_STARTED`、房主结束全部通过；game version `2→6`，最终状态 `finished`
- 规则版本：`hangzhou-v5-streamlined-board`
- 数据不变量：共享 data device:inode=`64771:2105925`，DB device:inode=`64771:2112440`，`PRAGMA quick_check=ok`
- 回滚点：`/opt/hangzhou-partners/releases/v0.8.0-20261013T075801Z` 存在且 version=0.8.0
- 启动说明：重启后的首个本机探针在启动窗口内短暂 connection refused，随后即时门与最终复核均稳定 200；切换后 journal 未发现 `level:error`、TypeError 或未处理异常
