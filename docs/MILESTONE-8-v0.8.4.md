# M8：v0.8.4

- 日期：2026-10-17
- 状态：D3 已获发布授权，等待本地完整门禁与生产实时预检
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

## 待回填

- 本地 `npm run verify -- --release`：待执行
- 唯一源码 SHA：待 D4 锁定
- 生产预检/切换/烟测：待执行
