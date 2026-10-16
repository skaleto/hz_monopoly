# M6：v0.8.2

- 日期：2026-10-16
- 状态：D4 已通过，允许从最终锁定 SHA 进入生产准备
- 规则版本：`hangzhou-v5-streamlined-board`（不改变 v0.8.1 玩法）
- 用户验收：用户从纠正后的三套背景实机图中选择 A“西湖水园”，并明确要求发布
- 发布源码：本次 D4 提交推送后，以 origin/main 唯一完整 SHA 锁定；`156e4d2…` 仅作预检证据且其产物禁用
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
