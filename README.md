# 杭城合伙局

当前稳定里程碑：**M3 / v0.7.0（发布准备完成，待生产切换）**

- 公网入口：<https://skbaby.top/hangzhou-partners/>
- 生产 release：`/opt/hangzhou-partners/releases/v0.5.2-20261009T042850Z`
- 形态：H5 熟人私密房，2–4 个席位，可补 Bot
- 里程碑证据：[docs/MILESTONE-3-v0.7.0.md](docs/MILESTONE-3-v0.7.0.md)
- 当前体验合同：[docs/requirements/gameplay-experience-v1.md](docs/requirements/gameplay-experience-v1.md)

## M1 能力

- 手机号验证码与昵称登录，HttpOnly 会话 Cookie；
- 创建/加入 6 位房间，真人准备，房主补 Bot 并开局；
- 服务端权威骰子、移动、岔路、投资、合伙、分红、建设、机遇和道具；
- 45 个方形节点、21 个可投资项目、青/紫两条连续岔路；
- 房主可结束本局并即时结算；
- WebSocket 快照/事件同步、刷新重连和断线宽限；
- 旧 v1.2 快照迁移，房间快照与事件原子提交，seq/version 单调保护；
- 多连接计数防误托管，stale/重复 END_GAME 幂等；
- 离页时取消旧事件、动画、Toast、录音和 Web Audio；
- Q 版 WebGL 骰子、短多骰音效、事件分型音效、头像到头像金币动画；
- SQLite 持久化、结构化脱敏日志、版本化静态资源缓存。

## 目录

```text
game-core/   权威规则、状态迁移与 Bot 策略
server/      HTTP、会话、房间、SQLite、WebSocket
public/      H5 页面与运行时静态资源
src/         骰子渲染源代码
scripts/     可复现资产/renderer 构建脚本
tests/       核心、集成、资源、GPU 与移动端 E2E
deploy/      启动脚本和 Nginx 示例
docs/        当前里程碑与体验合同
```

`public/assets/*.png` 是 WebP 的构建源，不能当作冗余产物删除；`public/assets/*.webp` 是线上运行资源。

## 本地运行

要求 Node.js 22.5+。

```bash
npm ci
cp .env.example .env
NODE_ENV=development SMS_MODE=dev DEV_SMS_CODE=123456 npm start
```

默认访问 <http://localhost:3000/hangzhou-partners/>。

## 验证

```bash
npm run verify
```

- `npm run verify` 是唯一日常验证入口：语法、禁止文件、生产依赖审计、核心/资源/HTTP/WebSocket 测试、390×844 E2E 和固定种子 M1 模拟；
- `npm run verify -- --release` 在上述门禁后追加发布树洁净度和 fresh 可复现构建；`npm run test:dice-headed` 仅作为可选的本机渲染诊断，不阻断发布；
- `npm run sim:balance -- --games 400 --all --output artifacts/balance/m2-candidates` 生成 M1 与候选规则对比，只用于数值体检，不替代真人试玩。

项目开发规约以 [HARNESS.md](HARNESS.md) 为唯一入口；Agent 专用入口只指向该文件，不维护重复规则。

M1 冻结门禁为 25/25 单元/集成测试、完整移动端 E2E、真实 ANGLE Metal renderer 证据以及生产公网/缓存/认证/DB 不变量。

## 生产边界

当前仍是受控演示服务：

- `SMS_MODE=dev` 只能配合随机 `DEMO_ACCESS_KEY` 使用；
- 正式开放前需接入短信供应商、账号删除、验证码/IP 限流与隐私政策；
- 当前单机 SQLite 适合小范围联调，扩容前需完成正式数据库和备份恢复方案。

部署必须使用全新 release、共享 data 绝对链接和原子 `current` 切换；不得直接覆盖生产目录。
