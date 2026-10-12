# M3 / v0.7.3 实现状态

## 结论

v0.7.3 延续 v0.7.1 的固定比例棋盘，清除两处支线文字残留遮挡、移除外层格底部色条，并让 49 个节点名称最多两行完整显示；于 2026-10-12 经用户验收和授权发布。v0.7.2 未进入生产。

- 规则版本：hangzhou-v4-sector-board（旧房间过期，提示新建）
- 里程碑证据：docs/MILESTONE-3-v0.7.3.md
- 线上 release：`/opt/hangzhou-partners/releases/v0.7.3-20261012T031241Z`
- 线上状态：页面/health 200；创建、开局、掷骰、移动、回合推进与结束烟测通过；`PRAGMA quick_check=ok`
- 375×667 / DPR3：scale 0.6319、棋盘比例 0.7165、49 个名称零截断、28/30 字形遮挡像素为 0、AABB >8% 为 0
- 回滚点：`/opt/hangzhou-partners/releases/v0.7.1-20261011T143844Z`

---

# 历史里程碑

## 结论

v0.5.2 是第一个稳定里程碑，详细历史证据保留在 [docs/MILESTONE-1-v0.5.2.md](docs/MILESTONE-1-v0.5.2.md)。历史里程碑中的门禁只说明当时的验证过程，不定义当前发布流程；当前规约以 [HARNESS.md](HARNESS.md) 为准。
