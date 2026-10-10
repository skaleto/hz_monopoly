# M3 / v0.7.0 实现状态

## 结论

v0.7.0 完成棋盘几何重制与 M3 城市事件/现金压力玩法，并于 2026-10-10 经用户验收和授权发布。

- 规则版本：hangzhou-v4-sector-board（旧房间过期，提示新建）
- 里程碑证据：docs/MILESTONE-3-v0.7.0.md
- 线上 release：`/opt/hangzhou-partners/releases/v0.7.0-20261010T100114Z`
- 线上状态：页面/health 200；创建、进入、开局、掷骰与回合推进烟测通过；`PRAGMA quick_check=ok`
- 回滚点：`/opt/hangzhou-partners/releases/v0.6.4-20261009T172903Z`

---

# 历史里程碑

## 结论

v0.5.2 是第一个稳定里程碑，详细历史证据保留在 [docs/MILESTONE-1-v0.5.2.md](docs/MILESTONE-1-v0.5.2.md)。历史里程碑中的门禁只说明当时的验证过程，不定义当前发布流程；当前规约以 [HARNESS.md](HARNESS.md) 为准。
