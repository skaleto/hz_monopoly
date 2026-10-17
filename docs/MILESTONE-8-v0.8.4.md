# M8：v0.8.4

- 日期：2026-10-17
- 状态：D4 已通过，v0.8.4 已发布并保留
- 规则版本：`hangzhou-v5-streamlined-board`（不改玩法）
- 源码基线：origin/main@`7f50960d0d8eca02cbdc8a1829644d09d894626c`
- 生产基线：v0.8.3
- 回滚点：精确 v0.8.3 release；不得覆盖 current 或任何历史 release

## 发布范围

- 将 BGM 替换为用户已试听选择的 01 `Cassette Tape Dream` 官方循环版。
- 正常音量 `0.34→0.18`，关键音效 duck `0.12→0.07`；保留音乐/音效独立开关与现有生命周期。
- 删除 v0.8.3 未被选择的 `City Loop` 音频与许可文件。
- 固化 OpenTracks/作者许可、官方源 SHA 与运行 OGG SHA；SOUNDRAW 试听文件不进入源码或工件。

## 发布契约

1. 仅从最终 D4 唯一完整 SHA fresh 构建全新 v0.8.4 release。
2. 生产写入前确认 current 精确 v0.8.3、服务/内外 health 正常、共享 data/DB 正确、`PRAGMA quick_check=ok`、精确 v0.8.3 回滚点存在。
3. 新 release 安装 production dependencies、建立共享 data 绝对链接，并复核 package/lock/cache=0.8.4、BGM SHA 与许可证据后才允许单次原子切换。
4. 切换/启动/基础 health、核心房烟测或 DB quick_check 任一失败，立即回滚精确 v0.8.3。
5. 烟测实时事件玩家字段必须读取 `event.payload.playerId`；成功后回填唯一源码、工件、release/current、测试房、DB 与回滚证据。

## 已完成门禁

- 隔离候选 `npm run verify -- --release`：PASS；41/41、390×844 双真人+双 Bot E2E、M1 200 局、M4 1000 局、27 文件 fresh 可复现构建均通过。
- 音频门禁：运行 OGG SHA、官方 Track 2 MP3 SHA、OpenTracks/作者许可一致；旧 `city-loop` 与 SOUNDRAW 文件为 0；production audit 0 vulnerabilities。
- 生命周期门禁：正式音轨启动、独立开关、正常音量 `0.18`、关键音效 duck `0.07`、AudioContext 恢复、回首页停止且不重启全部通过；console errors=0。

## 第一阶段生产只读预检

- D3 预检对象：`5fd20a268efddfbafc8eb0c70891b9a59375697e`；仅作预检证据，未生成/复用生产工件，禁止作为生产输入。
- current 精确 `/opt/hangzhou-partners/releases/v0.8.3-20261017T100808Z`；package/cache=0.8.3；ruleset 不变。
- service active/enabled；本机/public health 均为 200。
- data 为绝对链接 `/opt/hangzhou-partners/data`；共享 data dev:inode=`64771:2105925`；DB dev:inode=`64771:2112440`；`PRAGMA quick_check=ok`。
- 精确 v0.8.3 回滚点存在且 version=0.8.3；已有 v0.8.4 release=0；第一阶段生产零写入。
- 唯一生产源码：以本 D4 提交推送后的 origin/main 完整 SHA 为准，由第二阶段正式放行消息显式给出；不得沿用 D3 SHA 或其产物。

## 生产发布结果

- 唯一 D4 源码 SHA：`7f50960d0d8eca02cbdc8a1829644d09d894626c`；发布前已复核 origin/main 与 GitHub main 一致，D3 `5fd20a268efddfbafc8eb0c70891b9a59375697e` 及其产物未作为生产输入。
- 唯一工件：118 个文件成员，禁入项为 0，SHA256=`a1fe1f0abbfa415d6a5dcf78cd271a833be6fc31a64d35e78193854a0c7f308f`；fresh 解包完整 release verify 通过，远端原包与本地原包一致。
- 生产 release/current：`/opt/hangzhou-partners/releases/v0.8.4-20261017T121932Z`；package/lock/cache=`0.8.4`，production audit 0 vulnerabilities，data 绝对链接为 `/opt/hangzhou-partners/data`。
- 正式音轨：`public/audio/cassette-tape-dream-sharou.v1.ogg`，公网认证会话与 release 文件 SHA256 均为 `1b0b65d50e14dec10d6fe0ac456e8335baf9d61d6a5718bdeb22259ce567010a`；许可证 SHA256=`c7b6622d489ee2955b3625265d37e75ed5af3b2ec52b96b6b0620fea0dd7c11e`，官方 MP3 SHA256=`8287e4597866bfdd4a677e82b95a631d8e7fd6580bedcb0593b299285395d553`；mix=`0.18/0.07`，旧 `city-loop` 文件为 0。
- 最终服务门禁：service active；配置 `PORT=8427`、`BASE_PATH=/hangzhou-partners`，本机与公网 health 均为 200；认证 bootstrap/page/BGM=`302/200/200`。
- 核心烟测房 `774558`：第二真人、双 Bot、开局、headed Chromium 点击 `rollPromptButton`、移动、回合推进和房主结束全部通过；实时 `DICE_ROLLED` seq 1、`PLAYER_MOVED` seq 2、`TURN_STARTED` seq 6，玩家字段均按 `event.payload.playerId` 校验，browser issues=0；round `1→2`、game version `0→4→5`，终局 status=`finished`。
- 同房 DB 双证据：真人点击 action 为 seq 1–4（`DICE_ROLLED→PLAYER_MOVED→PLAYER_LANDED→PROPERTY_OFFERED`），同一真人决策 action 为 seq 5–6（`PROPERTY_SKIPPED→TURN_STARTED`），房主结束 action 为 seq 13–14（`GAME_ENDED_EARLY→GAME_FINISHED`）；ruleset=`hangzhou-v5-streamlined-board`。
- 共享 data dev:inode=`64771:2105925`，DB dev:inode=`64771:2112440`，`PRAGMA quick_check=ok`；环境与 Nginx SHA 未漂移。
- 精确回滚点 `/opt/hangzhou-partners/releases/v0.8.3-20261017T100808Z` 存在且 version=`0.8.3`；最终保留 v0.8.4，未触发最终回滚。

## 发布过程中的探针与临时 harness 修正

- 首次切换后页面/BGM 探针未建立 `hc_demo_access` Cookie，403 被按契约处理并回滚到精确 v0.8.3。只读对比证明 403 与版本无关；用户重新放行后复用同一 immutable release，并改为先通过 `?access=<DEMO_ACCESS_KEY>` 建立 Secure/HttpOnly Cookie、再访问清洁 URL。密钥未写入日志，非 2xx 响应未计算资产 SHA。
- 临时烟测房 `289209` 暴露采集器过早读取 Bot 行动前 snapshot；修正为等待双方 snapshot 达到开局版本且当前玩家为真人。该修正仅在 ignored harness 中，未修改源码、工件或 release。
- 临时烟测房 `529445` 暴露 `pending` union 映射的 eager 求值：非 route 的 `partner` 状态仍读取 `choices[0]`。DB 证明真人点击与 Bot partner timeout 均正常；回归用例先 RED 后 GREEN，harness 改为按 `pending.type` 分支，partner 使用 `targetPlayerId`。该修正同样未进入产品或 release。
- 本机默认 Node 因 Homebrew `simdutf` 动态库失配无法启动；临时 harness 改用已验证的独立 Node 绝对路径。另两次只读假阴性分别来自硬编码本机 3000 端口和未匹配 minified mix 字面量，均按生产配置/源码纠正后复测通过，不计为产品门禁失败。
