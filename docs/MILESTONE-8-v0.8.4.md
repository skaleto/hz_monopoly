# M8：v0.8.4

- 日期：2026-10-17
- 状态：D4 已通过，等待从唯一完整 SHA fresh 准备并切换生产
- 规则版本：`hangzhou-v5-streamlined-board`（不改玩法）
- 源码基线：origin/main@`1015ecb9be46b8b848c6a38d8d9bc5a9ae635838`
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

## 待回填

- 唯一 D4 源码 SHA：待提交后锁定
- 唯一工件 SHA/成员数：待 fresh 构建
- 生产 release/current、核心烟测房、DB 与回滚结果：待执行
