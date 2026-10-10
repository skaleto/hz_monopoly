# M3：v0.7.0

- 里程碑日期：2026-10-10
- 状态：发布准备完成；生产切换待持有服务器权限的环境执行
- 公网入口：<https://skbaby.top/hangzhou-partners/>
- 回滚点：生产 v0.6.4 release（`/opt/hangzhou-partners/current` 切换前不变）

## 里程碑定义

v0.7.0 = **棋盘几何重制 + M3 玩法候选**，经用户明确授权整分支发布（2026-10-10 "直接发"）。

- 49 节点棋盘：主环 34 节点圆角矩形轨道弧长等距 + 水线/地铁等弧长圆弧支线（8+7），
  全体节点两两最小间距 42.1px（=格宽，零重叠）；坐标由 `scripts/generate-board-layout.js`
  生成至 `sims/board-layout.json`，不再手写
- 节点语义归位：拱宸桥码头/香积寺晨市→水线，地铁快线→地铁线，地铁补给站留主路
- 五产业板块（5×5 项目）与城市事件、现金压力、道具、偶数脱困候选（需求包
  `city-events-cash-pressure-v1.md`，授权记录见该文件）
- rulesetVersion 升至 `hangzhou-v4-sector-board`；进行中的旧版本房间返回 `RULESET_EXPIRED`

## 验收证据

- verify --release（发布机 Linux）：tracked-tree 洁净、JS 语法、依赖审计、42/42 单元/集成/资源、
  390×844 双真人+双 Bot 完整 E2E、M1 200 局与 M3 1000 局固定种子模拟双门禁、可复现资产构建 —— 以上 9 项全绿
- headed GPU 骰子检查保留为可选的本机诊断，不纳入 v0.7.0 发布阻断门禁（用户于 2026-10-10 明确授权移除该测试点）；
- 布局硬门禁（本轮新增，防退化）：全局 49 节点两两重叠比 ≤2% 且显著重叠对=0；
  支线最小间距 ≥41px、最大转角 ≤60°、路径比 ≤1.35
- 布局独立复核：渲染几何实测 20 对重叠（15–22%）→ 3 对亚像素贴边（≤0.5%）；
  主环节奏 29–116px 跳动 → 恒定 43.7px

## 发布边界

- 本仓库只产出唯一工件与 SHA；`/opt/hangzhou-partners/releases/` 目录创建、共享 data
  链接与原子 `current` 切换由持有服务器权限的环境按 HARNESS §5 执行
- 切换后按惯例回填生产 release 路径与 SHA 到本文件与 IMPLEMENTATION-STATUS.md
