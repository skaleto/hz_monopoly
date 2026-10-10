# M3 / v0.7.0 实现状态

## 结论

v0.7.0 完成棋盘几何重制（生成式布局 + 零重叠硬门禁）与 M3 城市事件/现金压力候选；verify --release 全绿，2026-10-10 经用户授权发布。生产切换待执行，回滚点 v0.6.4。

- 规则版本：hangzhou-v4-sector-board（旧房间过期，提示新建）
- 里程碑证据：docs/MILESTONE-3-v0.7.0.md
- 工件：杭城合伙局-H5联机-v0.7.0.tar.gz（SHA256 见发布记录）

---

# M1 / v0.5.2 实现状态

## 结论

v0.5.2 是“杭城合伙局”的第一个稳定里程碑，已正式保留在线。

- release：`/opt/hangzhou-partners/releases/v0.5.2-20261009T042850Z`
- 工件 SHA256：`b12280a0d1db486160ae473a3c3887adaeeb6729c245b1e96fc1aca8be6c36d7`
- renderer SHA256：`05cadf7aaaacb8e86b0643d8693550d9507cc6ed340995139f471c044a0c3741`
- 生产健康：本机/公网 `200/47`，服务 active，`NRestarts=0`
- 持久化：共享 data/DB inode 不变，`PRAGMA quick_check=ok`

## 已完成合同

- 2–4 席熟人房、Bot、准备/开局、刷新重连；
- 服务端权威 12 轮状态机与幂等命令；
- 45 节点、21 投资格、投资/合伙/建设/分红/机遇/道具；
- 房主结束与排名；
- Q 版骰子、分型音效、Toast、庆祝与金币动画；
- v1.2 快照字段迁移；
- 人类命令 + Bot 连锁在单一 SQLite transaction 中提交 events + snapshot；
- room queue 串行写与 seq/version 单调保护；
- 路线超时、缺 choices/movement 恢复；
- 同 user/room 多 socket 防误托管；
- stale END_GAME 与重复 END_GAME 幂等；
- snapshot 优先同步、终局抢占、离页全量取消；
- ws/timer/rejection 脱敏日志。

## M1 门禁

- 核心/集成/资源：25/25；
- 完整 390×844 E2E：通过，console/page errors=0；
- 双 socket 关闭旧连接后 activeSockets=1、trustee=false；
- stale END_GAME 成功，重复 END_GAME `idempotent=true`；
- goHome 后 sound trace 不增长，coin/Toast/dice/celebration 全部清空；
- renderer 构建可复现，真实 headed ANGLE Metal 已验收；
- 公网 bundle SHA、缓存/304、认证 3/3、DB/config/shared services 全绿；
- 切换后 `level:error=0`、`trustee_timer_fire=0`、`command_rejected=0`。

## 冻结边界

M1 冻结骰子概率、经济公式、45 节点拓扑、12 轮上限、投资/合伙/建设规则和 v0.5.2 生命周期合同。后续变更必须新版本、更新体验合同并重新通过对应门禁。

## 未纳入 M1

- 真实短信供应商与正式账号治理；
- PostgreSQL/Redis、多实例扩容；
- 运维管理台、完整监控告警和正式备份恢复演练；
- 微信小游戏原生客户端。
