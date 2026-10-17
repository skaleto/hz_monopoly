# M9：v0.8.5

- 日期：2026-10-17
- 状态：已发布并保留
- 生产基线/回滚点：v0.8.4
- 规则版本：`hangzhou-v5-streamlined-board`（不改玩法）

## 候选范围

- 卡片恢复真正的 180°水平翻牌：先显示与正面同色系的浅色城市徽记卡背，再翻到文字正面；卡背 0→180°、正面 -180→0°同步翻转，两面都启用 `backface-visibility:hidden`，不出现镜像文字。
- 卡片入场 `820→620ms`，稳定阅读 `2400→1500ms`，总展示约 `3.2→2.12s`；翻牌包含一次角度过冲和一次回摆，保留惯性。
- `Cassette Tape Dream` 正常音量 `0.18→0.10`，关键音效 duck `0.07→0.025`。
- 不改音轨、音效、卡片内容、金币反馈、服务端或规则。

## 已完成门禁

- `npm run verify`：PASS；41/41 测试、390×844 双真人+双 Bot E2E、M1 200 局、M4 1000 局、production audit 0。
- 卡片门禁：390×844 E2E 与最终完整 `npm run verify` PASS；0.62 秒完成 0→194→174→180°惯性回摆、两面 backface hidden、稳定阅读约 1.5 秒、总展示约 2.12 秒。
- 音乐门禁：正式 01 音轨不变；正常/duck 音量 `0.10/0.025`；音乐/音效独立开关、后台恢复与回首页停止回归通过。
- 用户已查看惯性版视频并明确说“发布”；按 HARNESS 单轮轻量流程执行，不再追加 D3/D4 双阶段或重复 full verify。

## 生产发布结果

- 发布源码：`328fb2ff3b69a9f3445cc33227b8c0485ae19e7e`。
- release/current：`/opt/hangzhou-partners/releases/v0.8.5-20261017T142752Z`；version/cache=`0.8.5`。
- service active；本机与公网 health 均为 200；正确访问认证后的页面为 200。
- 核心烟测房 `766352`：第二真人、双 Bot、开局、headed Chromium 点击投掷、移动、回合推进和房主结束通过；终局 `finished`，game version=`6`，round=`2`。
- 发布后 `PRAGMA quick_check=ok`。
- 回滚点 `/opt/hangzhou-partners/releases/v0.8.4-20261017T121932Z` 存在且 version=`0.8.4`；本次未触发回滚，最终保留 v0.8.5。
