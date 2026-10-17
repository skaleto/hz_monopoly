# 需求包：正式 BGM 音轨接入

- 需求包版本：v1
- 成熟度：D4
- 原始需求：用户否定程序化合成音乐，选择 SOUNDRAW A 方向后要求集成发布；在确认匿名试听文件无正式授权且其提取方式不合规后，用户从阻塞式选项中选择“改用可直接商用的替代 BGM”
- 输入形态：明确改造与发布授权
- 证据截止时间：2026-10-17
- 主负责人：Coding Agent（TRAE）
- 决策人/验收人：姚怡斌
- 已授权合入主干：yes
- 已授权发布/生产写入：yes（2026-10-17 “把这个 BGM 集成上去，然后发布一版给我看看”；授权风险澄清后选择 `alternative`）

## 目标与边界

- 目标：用真实编曲音轨替代程序化振荡器 BGM；保留音乐独立开关、对局内播放、离页/后台停止和恢复；BGM 有存在感但关键音效出现时自动降低音量。
- 采用资产：OpenGameArt `City Loop`，作者 `wipics`，源页面明确标记 `CC0`；页面描述为 “City Loop. Has an upbeat feel to it.”。
- 非目标：不改游戏规则、服务端协议、骰子和金币音效；不使用 SOUNDRAW 匿名试听文件；不把 BGM 伪称为 AI 生成。
- 正例：进入进行中的对局后音乐开始；关闭音效不影响音乐；关闭音乐立即停止；骰子/金币等音效触发时 BGM 短暂 duck；返回首页、切后台或结束对局后音乐停止。
- 反例：首页或等待房播放；关闭音乐后仍有音频；多个 BGM 实例叠播；SOUNDRAW 试听分轨进入仓库；许可证据缺失。

## 授权与资产证据

| 项目 | 证据 |
| --- | --- |
| 来源页 | `https://opengameart.org/content/city-loop-0` |
| 作者 | `wipics` |
| 许可证 | Creative Commons CC0 1.0 Universal；允许复制、修改、分发和商业使用，无强制署名 |
| 原 MP3 SHA256 | `9349982fb8e365167bc5c89f2ac50d3b5376b9f627d506ba30a9b26c8230597e` |
| 运行 OGG SHA256 | `869e66edb03f03f88babe071053a9b3c92208da6524478d3787ed35a942828f4` |
| 固化位置 | `public/audio/city-loop-cc0.v1.LICENSE.txt` 与 `public/audio/city-loop-cc0.v1.ogg` |
| 派生处理 | 去除源文件尾部静音，将 1 秒头尾交叉淡化形成 53.17 秒循环，编码为 Ogg Vorbis |

## 实现合同

- 使用单个 `HTMLAudio` 实例播放 `city-loop-cc0.v1.ogg`，`loop=true`，不再调度程序化和弦/振荡器。
- 正常音乐音量 `0.34`；关键音效期间降至 `0.12`，结束后恢复，音效开关和音乐开关继续独立持久化。
- `visibilitychange`、回首页、取消对局反馈、终局和测试 suspend 都复用现有生命周期入口停止音乐并归零播放位置。
- 音频资产小于 1.5 MB；服务端沿用已验证的 `audio/ogg` MIME。

## 验收与停止条件

- `tests/assets.test.js` 固定运行音频 SHA、许可证页/源 SHA、资产预算，并禁止程序化 `musicChords/scheduleMusicStep` 回归。
- 390×844 双真人+双 Bot E2E 验证正式文件启动、独立开关、AudioContext 恢复、回首页停止且不重启。
- `npm run verify -- --release` 必须全绿；发布后执行页面/health、核心房、DB quick_check 和精确 v0.8.2 回滚点四项基础门禁。
- 任一许可不一致、音频无法解码、生命周期叠播、完整 verify 失败或用户认为曲风不合适，立即停止/回滚。

## D4 门禁证据

- 隔离候选完整 `npm run verify -- --release`：PASS；41/41 测试、390×844 双真人+双 Bot E2E、M1 200 局、M4 1000 局、27 文件 fresh 可复现构建、production audit 0 vulnerabilities。
- E2E 实测正式文件 `city-loop-cc0.v1.ogg` 启动；音乐/音效开关互不影响；关键音效将音乐从 `0.34` 降至 `0.12` 后恢复；AudioContext 恢复与回首页停止通过；console errors=0。
- 第一阶段生产只读预检：current 精确 v0.8.2；service active；本机/public health=200；共享 data 与 DB 正确；`PRAGMA quick_check=ok`；精确 v0.8.2 回滚点存在；已有 v0.8.3 release=0。
- D3 预检对象 `f5d293fe81dd4ba8ac560dabb679445fb3d5f228` 仅作证据，禁止生成或复用生产工件。唯一生产源码由本 D4 提交推送后的 origin/main 完整 SHA 与第二阶段正式放行消息共同锁定。

## 变更控制

- 基线：origin/main@`ff3e8a0cab25599110d1ce67de20b27de9035dad` / 生产 v0.8.2。
- 范围：`public/app.js`、`public/audio/`、`tests/assets.test.js`、`tests/e2e.js`、版本/cache、当前需求包与 M7。
- 回滚：恢复 v0.8.2 的程序化 BGM 逻辑并删除 v0.8.3 音轨引用；生产回滚到精确 v0.8.2 release。
- 当前状态：D4 已通过，允许从新的唯一完整 SHA fresh 构建全新 v0.8.3 release；生产尚未写入。
