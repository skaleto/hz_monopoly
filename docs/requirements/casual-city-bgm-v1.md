# 需求包：休闲都市 BGM 定稿

- 需求包版本：v1
- 成熟度：D4
- 原始需求：用户认为 v0.8.3 BGM 过于劲爆、音量偏大且不符合休闲都市小游戏风格；在三首正规授权候选中选择 01 `Cassette Tape Dream`，明确要求修改并发布
- 输入形态：明确选曲与发布授权
- 证据截止时间：2026-10-17
- 主负责人：Coding Agent（TRAE）
- 决策人/验收人：姚怡斌
- 已授权合入主干：yes
- 已授权发布/生产写入：yes（2026-10-17 “用01吧，开始修改并发布”）

## 目标与边界

- 目标：将 v0.8.3 偏强烈的 CC0 曲目替换为用户已试听选择的 City Pop / Soul / Funk 中速循环曲；整体音量下调，保留音乐独立开关和关键音效 duck。
- 采用资产：OpenTracks（原 DOVA-SYNDROME）官方 Track 2 循环版 `Cassette Tape Dream`，作者 しゃろう。
- 非目标：不改规则、服务端协议、音效音色或 UI；不使用 SOUNDRAW 匿名试听文件；不保留 v0.8.3 的 `City Loop` 运行资产。
- 正例：进入进行中对局播放 01；音乐正常音量明显低于 v0.8.3；关键音效时进一步降低；关闭音乐、离页、后台和终局均停止。
- 反例：播放旧 `City Loop`、首页/等待房播放、多个音乐实例叠加、BGM 压住骰子或金币音效、缺少来源与许可链路。

## 授权与资产证据

| 项目 | 证据 |
| --- | --- |
| 来源页 | `https://opentracks.com/bgm/detail/13963` |
| 官方下载页 | `https://opentracks.com/bgm/detail/13963/download`；选择 Track 2（loop） |
| 作者 | `しゃろう`；作者页声明遵循站点许可、无额外限制、署名非必需 |
| 站点许可 | 允许商业/非商业、个人/法人作品；明确包括付费/免费 App、Web 服务和游戏；允许格式转换与循环编辑 |
| 官方 MP3 SHA256 | `8287e4597866bfdd4a677e82b95a631d8e7fd6580bedcb0593b299285395d553` |
| 运行 OGG SHA256 | `1b0b65d50e14dec10d6fe0ac456e8335baf9d61d6a5718bdeb22259ce567010a` |
| 固化位置 | `public/audio/cassette-tape-dream-sharou.v1.ogg` 与同名 `.LICENSE.txt` |

## 实现合同

- 延续单 `HTMLAudio`、`loop=true` 和现有音乐生命周期；仅替换文件与混音参数。
- 正常音乐音量从 `0.34` 降到 `0.18`；关键音效期间从 `0.12` 降到 `0.07`，结束后恢复到 `0.18`。
- 删除 v0.8.3 `city-loop-cc0.v1.*`，避免 release 同时携带未使用的大音频。
- 音效/音乐开关继续独立持久化；`visibilitychange`、回首页、取消反馈、终局与测试 suspend 继续停止并归零音乐。

## 验收与停止条件

- 资产测试固定运行 OGG SHA、官方 MP3 SHA、来源/许可页和 2.5 MB 预算，并禁止旧运行曲目回归。
- 390×844 双真人+双 Bot E2E 验证 01 文件启动、音量 `0.18`、duck `0.07`、独立开关、恢复与回首页停止。
- `npm run verify -- --release` 必须全绿；发布后验证页面/health、正式音轨 SHA、核心房、DB quick_check 与精确 v0.8.3 回滚点。
- 任一授权证据不一致、音频无法解码、生命周期回归、完整 verify 失败或用户试听仍不接受，停止/回滚。

## D4 门禁证据

- 隔离候选完整 `npm run verify -- --release`：PASS；41/41 测试、390×844 双真人+双 Bot E2E、M1 200 局、M4 1000 局、27 文件 fresh 可复现构建、production audit 0 vulnerabilities。
- E2E 实测 `cassette-tape-dream-sharou.v1.ogg` 启动；正常音量 `0.18`，关键音效 duck `0.07` 后恢复；音乐/音效独立开关、AudioContext 恢复、回首页停止通过；console errors=0。
- 第一阶段生产只读预检：current 精确 v0.8.3；service active/enabled；本机/public health=200；共享 data 与 DB 正确；`PRAGMA quick_check=ok`；精确 v0.8.3 回滚点存在；已有 v0.8.4 release=0。
- D3 预检对象 `5fd20a268efddfbafc8eb0c70891b9a59375697e` 仅作证据，禁止生成或复用生产工件。唯一生产源码由本 D4 提交推送后的 origin/main 完整 SHA 与第二阶段正式放行消息共同锁定。

## 变更控制

- 基线：origin/main@`1015ecb9be46b8b848c6a38d8d9bc5a9ae635838` / 生产 v0.8.3。
- 范围：音频资产与许可、`public/app.js`、测试、package/lock/cache、当前需求包与 M8。
- 回滚：恢复精确 v0.8.3 release；不得覆盖历史 release。
- 当前状态：D4 已通过，允许从新的唯一完整 SHA fresh 构建全新 v0.8.4 release；生产尚未写入。
