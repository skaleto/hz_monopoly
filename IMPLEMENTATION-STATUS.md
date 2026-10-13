# M4 / v0.8.0 实现状态

## 结论

v0.8.0 移除板块进度与数值奖励，精简移动端对局面，并让棋盘中央的同一 WebGL 骰子承担待点击与投掷动画；于 2026-10-13 经用户双尺寸截图验收和明确授权发布并保留。

- 规则版本：hangzhou-v5-streamlined-board（旧规则房间过期，提示新建）
- 里程碑证据：docs/MILESTONE-4-v0.8.0.md
- 源码提交：`72fb273e3bfe65d2c94fa8ecfd72f9963d1f1418`
- 线上 release：`/opt/hangzhou-partners/releases/v0.8.0-20261013T075801Z`
- 线上状态：页面及内外 health 200；创建、进入、开局、投掷、移动、回合推进与结束烟测通过；`PRAGMA quick_check=ok`
- 发布烟测房：`806025`，round 1→2、game version 2→6，最终 `finished`
- 回滚点：`/opt/hangzhou-partners/releases/v0.7.3-20261012T031241Z`

---

# 历史里程碑

## 结论

v0.5.2 是第一个稳定里程碑，详细历史证据保留在 [docs/MILESTONE-1-v0.5.2.md](docs/MILESTONE-1-v0.5.2.md)。历史里程碑中的门禁只说明当时的验证过程，不定义当前发布流程；当前规约以 [HARNESS.md](HARNESS.md) 为准。
