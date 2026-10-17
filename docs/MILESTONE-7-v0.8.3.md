# M7：v0.8.3

- 日期：2026-10-17
- 状态：D3 已获发布授权，等待本地完整门禁与生产实时预检
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

## 待回填

- 本地 `npm run verify -- --release`：待执行
- 唯一源码 SHA：待 D4 锁定
- 生产预检/切换/烟测：待执行
