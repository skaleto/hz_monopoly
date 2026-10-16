# M6：v0.8.2

- 日期：2026-10-16
- 状态：D4 已发布并保留，未触发回滚
- 规则版本：`hangzhou-v5-streamlined-board`（不改变 v0.8.1 玩法）
- 用户验收：用户从纠正后的三套背景实机图中选择 A“西湖水园”，并明确要求发布
- 发布源码：`7eef2f41de8cc97fdfd7f0b13470b165b0a18277`；`156e4d2…` 仅作预检证据且其产物未使用
- 生产基线：`/opt/hangzhou-partners/releases/v0.8.1-20261016T053327Z`（My Mac 已实时只读复核）
- 回滚点：精确生产 v0.8.1 release；不得覆盖 current 或任何历史 release

## 发布范围

- 修复“别人/机器人行动时自己仍看到点击投掷”：新增 roll command-in-flight 与 event playback 双锁，权威快照应用且事件队列空闲后才恢复入口
- 方案 A 西湖水园定稿：`board_water_garden.png` 为 728×1016 源，`board.v4.webp` 为正式运行资源
- 小屏棋盘容器按 364:508 内容比例收紧，不再用纯蓝区域伪装棋盘表面
- 普通节点和项目图标改为 v2 裁切素材，在不扩大 22/17px 布局框的前提下放大主体，避免挤压名称与价格
- BGM 不在本次范围；继续使用 v0.8.1 音乐逻辑，等待带商用授权的 AI 编曲音轨单独验收

## 已完成门禁

- 375×667、390×844 E2E：PASS；双客户端投掷入口在命令在途、骰子动画、移动动画和事件回放期间均正确隐藏
- 49 节点：0 broken images、0 名称/价格重叠、0 截断、正方形与全局 AABB 门禁通过
- `npm run verify`：PASS；40/40、390×844 E2E、M1 200 局、M4 1000 局均通过
- `node scripts/verify-reproducible-build.js`：PASS；v4 棋盘、v2 节点/项目素材与 dice renderer 可复现

## 生产发布契约

1. 从最终 D4 唯一完整 SHA fresh 构建全新 v0.8.2 release，不沿用预检产物。
2. 生产写入前确认 current 精确 v0.8.1、服务与内外 health 正常、共享 data/DB 正确、DB quick_check=ok、精确 v0.8.1 回滚点存在。
3. 新 release 安装 production dependencies、建立共享 data 绝对链接，并复核 package/lock/cache=0.8.2 后才允许单次原子切换。
4. 切换/启动/基础 health 失败立即回滚 v0.8.1；核心房烟测或 DB quick_check 失败同样回滚。
5. 成功后回填唯一源码、工件 SHA/成员数、release/current、烟测房间、DB 与回滚证据。

## D4 实时预检

- origin/main（D3 授权提交）：`156e4d2b2d06c63243aa4320b5df627d0ebb3290`；package/lock/cache 均为 0.8.2，ruleset=`hangzhou-v5-streamlined-board`
- current：symbolic link，精确 `/opt/hangzhou-partners/releases/v0.8.1-20261016T053327Z`，version=0.8.1
- service：active，监听 `127.0.0.1:8427`；本机/public health 均为 200
- data：绝对链接 `/opt/hangzhou-partners/data`；shared data device:inode=`64771:2105925`
- DB device:inode=`64771:2112440`；`PRAGMA quick_check=ok`
- 精确 v0.8.1 回滚点存在且 version=0.8.1；已有 v0.8.2 release 数量为 0
- My Mac 结论：源码与生产基础设施 READY；预检阶段未上传、未创建 release、未切 current、未重启、未修改 DB/配置或生产文件

## 生产发布结果

- 结论：v0.8.2 已保留，未触发回滚；唯一原子切换时间为 `2026-10-16T10:11:51Z`
- 唯一源码：`7eef2f41de8cc97fdfd7f0b13470b165b0a18277`
- 唯一工件：112 成员，SHA256=`94f6b6b7ba550d56f93f4e22055767be8610a2b3287c3d848fceba326a6ab52b`；排除 `.git`、`node_modules`、screenshots、artifacts、data/DB 与历史 tar
- fresh 门禁：`npm run verify -- --release` PASS；40/40、390×844 E2E、M1 200 局、M4 1000 局、27 文件可复现构建均通过；fresh 解包固定使用已验证的 Node 22.23.2，未修改源码、lock 或工件
- 生产 release/current：`/opt/hangzhou-partners/releases/v0.8.2-20261016T101038Z`
- 生产依赖：仅 `ws@8.22.0`；production audit 为 0 vulnerabilities；`data` 为指向 `/opt/hangzhou-partners/data` 的绝对链接
- 版本与健康：package/lock/app、styles、dice-renderer 三个 cache key 均为 `0.8.2`；service active；本机与公网 health 均为 200
- 核心烟测房 `691235`：第二真人进入、双 Bot、开局、真人点击投掷、`DICE_ROLLED`、`PLAYER_MOVED`、`TURN_STARTED`、房主结束全部通过；game version `0→4`，最终状态 `finished`
- 规则版本：`hangzhou-v5-streamlined-board`
- 数据不变量：共享 data device:inode=`64771:2105925`，DB device:inode=`64771:2112440`，`PRAGMA quick_check=ok`
- 回滚点：`/opt/hangzhou-partners/releases/v0.8.1-20261016T053327Z` 存在且 version=0.8.1
- 启动说明：重启后的首个本机探针在启动窗口内短暂 connection refused，随后即时门与最终复核均稳定 200；切换后 journal 未发现 `level:error`、TypeError 或未处理异常
