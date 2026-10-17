# M7：v0.8.3

- 日期：2026-10-17
- 状态：D4 已通过，等待从唯一完整 SHA fresh 准备并切换生产
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

## 待回填

- 唯一 D4 源码 SHA：待提交后锁定
- 唯一工件 SHA/成员数：待 fresh 构建
- 生产 release/current、核心烟测房、DB 与回滚结果：待执行
