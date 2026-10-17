# M7：v0.8.3

- 日期：2026-10-17
- 状态：D4 已发布并保留；首次烟测采集器假阴性触发回滚，用户明确选择修正临时采集器后从同一 immutable release 重新完整发布
- 规则版本：`hangzhou-v5-streamlined-board`（不改玩法）
- 源码基线：origin/main@`ff3e8a0cab25599110d1ce67de20b27de9035dad`
- 生产基线：v0.8.2
- 回滚点：精确 v0.8.2 release；不得覆盖 current 或任何历史 release

## 发布范围

- 删除程序化和弦 BGM 调度，接入 `City Loop` CC0 正式音轨。
- 保留音乐/音效独立开关；仅在进行中的对局播放，回首页、切后台、终局和停止反馈时立即停止。
- 正常音量提高到可感知水平；骰子、金币、卡片等关键音效触发时临时降低 BGM，避免遮挡反馈。
- 固化来源页、作者、许可证、源文件与运行文件 SHA；SOUNDRAW 匿名试听文件不进入源码或工件。

## 发布契约

1. 仅从最终 D4 唯一完整 SHA fresh 构建全新 v0.8.3 release。
2. 生产写入前确认 current 精确 v0.8.2、服务/内外 health 正常、共享 data/DB 正确、`PRAGMA quick_check=ok`、精确 v0.8.2 回滚点存在。
3. 新 release 安装 production dependencies、建立共享 data 绝对链接，并复核 package/lock/cache=0.8.3、BGM SHA 与许可证据后才允许单次原子切换。
4. 切换/启动/基础 health、核心房烟测或 DB quick_check 任一失败，立即回滚精确 v0.8.2。
5. 成功后回填唯一源码、工件 SHA/成员数、release/current、测试房、DB 与回滚证据。

## 已完成门禁

- 隔离候选 `npm run verify -- --release`：PASS；41/41、390×844 双真人+双 Bot E2E、M1 200 局、M4 1000 局、27 文件 fresh 可复现构建均通过。
- 音频门禁：运行 OGG SHA 固定；许可证据、源 SHA 和运行 SHA 一致；仓库内 SOUNDRAW/源 MP3 禁入文件为 0；production audit 0 vulnerabilities。
- 生命周期门禁：正式音轨启动、独立开关、关键音效 duck `0.34→0.12→0.34`、AudioContext 恢复、回首页停止且不重启全部通过；console errors=0。

## 第一阶段生产只读预检

- D3 预检对象：`f5d293fe81dd4ba8ac560dabb679445fb3d5f228`；仅作预检证据，未生成/复用生产工件，禁止作为生产输入。
- current/link/realpath 精确 `/opt/hangzhou-partners/releases/v0.8.2-20261016T101038Z`；package/lock/cache=0.8.2；ruleset 不变。
- service active，监听 `127.0.0.1:8427`；本机正确 BASE_PATH health 与公网 health 均为 200。
- data 为绝对链接 `/opt/hangzhou-partners/data`；共享 data dev:inode=`64771:2105925`；DB dev:inode=`64771:2112440`；`PRAGMA quick_check=ok`。
- 精确 v0.8.2 回滚点存在且 version=0.8.2；已有 v0.8.3 release=0；第一阶段生产零写入。
- 唯一生产源码：以本 D4 提交推送后的 origin/main 完整 SHA 为准，由第二阶段正式放行消息显式给出；不得沿用 D3 SHA 或其产物。

## 生产发布结果

- 唯一 D4 源码：`cc80bf25834ea4739d8f5cebed82256e5bfa96dc`；D3 `f5d293fe81dd4ba8ac560dabb679445fb3d5f228` 及其产物未用于生产。
- 唯一工件：116 成员，SHA256=`0aa3cede020c079c2d80cc5f4616e283ac347a044053b424089e1fd3a9940325`；排除 `.git`、`node_modules`、screenshots、artifacts、data/DB 与历史 tar。
- fresh 门禁：原 worktree 与同一工件 fresh 解包的 `npm run verify -- --release` 均 PASS；41/41、390×844 双真人+双 Bot E2E、M1 200 局、M4 1000 局、27 文件可复现构建和 production audit 0 全部通过。
- immutable 再验：以同一 116 文件 manifest 对本地工件内容和现有 release 逐文件 SHA256 聚合，两端均为 `8150b9adbc2b3063e311047b0f1ff5f04cd2ef7d101a64b33fc6e5ac7b71ca42`。
- 生产 release/current：`/opt/hangzhou-partners/releases/v0.8.3-20261017T100808Z`；最终保留切换时间 `2026-10-17T10:18:45Z`。
- 生产依赖：仅 `ws@8.22.0`；`data` 为指向 `/opt/hangzhou-partners/data` 的绝对链接。
- 版本与健康：package/lock/app、styles、dice-renderer 三个 cache key 均为 `0.8.3`；service active；本机与公网 health 均为 200；切换后服务错误计数为 0。
- 正式 BGM：本机与公网资源均可读，运行 SHA256=`869e66edb03f03f88babe071053a9b3c92208da6524478d3787ed35a942828f4`；CC0 许可证据与运行 SHA 一致。
- 核心烟测房 `162925`：第二真人、双 Bot、开局、真人投掷、`DICE_ROLLED`、`PLAYER_MOVED`、`TURN_STARTED`、回合推进和房主结束全部通过；实时广播按 `event.payload.playerId` 校验，game version `2→6`，最终 `finished`。
- DB 双证据：该真人回合 seq 区间持久化链为 `DICE_ROLLED→PLAYER_MOVED→PLAYER_LANDED→RENT_PAID→TURN_STARTED`；终局包含 `GAME_ENDED_EARLY` 与 `GAME_FINISHED`，房间最终 seq=15，ruleset=`hangzhou-v5-streamlined-board`。
- 数据不变量：共享 data dev:inode=`64771:2105925`，DB dev:inode=`64771:2112440`，`PRAGMA quick_check=ok`。
- 回滚点：`/opt/hangzhou-partners/releases/v0.8.2-20261016T101038Z` 存在且 version=0.8.2。
- 首次切换说明：`2026-10-17T10:10:15Z` 首次切换后的服务端事件链完整，但临时烟测误读 `event.playerId` 而非 `event.payload.playerId`，触发 `TURN_ADVANCED_WITHOUT_REQUIRED_EVENTS` 并按契约精确回滚 v0.8.2。DB 证明这是假阴性；用户随后通过阻塞式选择明确授权修正临时采集器并重新完整发布，同一源码、工件和 release 内容均未改变。
