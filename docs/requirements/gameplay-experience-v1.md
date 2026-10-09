# 需求包：对局操作、棋盘语义与高光动画改版

- 需求包版本: v8
- 成熟度: D4
- 原始需求: 用户于 2026-10-08 至 2026-10-09 连续提出的对局体验反馈与线上房间 941415 故障
- 知识源地图: 项目未提供 `.agents/requirement-sources.yaml`
- 本次采用的知识源: 用户反馈、线上 v0.5.0、`game-core/index.js`、`public/app.js`、`public/styles.css`、现有 E2E
- 输入形态: IDEA
- 证据截止时间: 2026-10-09
- 主负责人: Coding Agent（TRAE）
- 评审人: 姚怡斌（v0.5.2 事故修复验收与发布授权）、Coding Agent（My Mac）（生产独立门禁）
- 决策人: 姚怡斌
- 已授权合入主干: yes（2026-10-09 当前消息“确认”）
- 已授权发布/生产写入: yes（2026-10-09 当前消息“确认”，明确承接上条“确认后发布 v0.5.2”）

## 方向

- 目标用户: 手机端多人对局中的房主与普通玩家
- 问题/当前行为: 线上房间 941415 在岔路入口疑似卡住且结束本局报 undefined；投资口径不统一、可投资项目占比不足；节点外形不统一；Toast 不醒目；事件音效同质；微信切后台后 Web Audio 丢失；金币动画未落在头像；两条岔路仍显散乱
- 期望结果: 对局不会因岔路决策或旧快照永久卡死；结束本局始终可结算；投资成为核心循环；所有节点统一方形；重要反馈在玩家栏下方可见；事件可凭音效区分；微信恢复后音效自动重启；金币明确从付款头像飞向收款头像
- 非目标: 不改变骰子概率、租金公式、项目/地图/音效内容、轮次上限、Bot 策略、持久化表结构；只发布通过完整门禁的唯一 v0.5.2 工件
- 准确对象锚点: `/hangzhou-partners/` 对局页、权威游戏命令与事件流
- 第一个验收样例: 非当前玩家看到“建设”禁用且有原因；当前玩家点击“建设”可选择具体项目并看到成本与分红提升

## 证据台账

| 判断 | 证据 | 时效/版本 | 可信状态 | 冲突 |
| --- | --- | --- | --- | --- |
| 当前无结束本局命令 | core/server/client 均无 `END_GAME` | v0.4.5 | 已验证 | 无 |
| 建设入口缺少解释且自动选择第一个项目 | `upgradeButton` click handler 与 `UPGRADE_PROPERTY` | v0.4.5 | 已验证 | 无 |
| 建设服务端已有回合权限 | core 要求 phase=roll 且 currentPlayer=actor | v0.4.5 | 已验证 | 用户看到可建设说明前端状态表达仍不足 |
| 分红已有 4 枚金币动画但辨识度不足 | `animateCoinTransfer` 与用户现场反馈 | v0.4.5 | 已验证 | 用户反馈优先 |
| 所有节点目前共用奶油底 | `.board-tile` 与现有 E2E 强制单一背景 | v0.4.5 | 已验证 | 新需求明确推翻旧设计 |
| 水线与地铁线节点数据已存在 | board `inner=water/metro` 与两个入口/出口 | v0.4.5 | 已验证 | 无 |
| 合伙与买项目已有权威事件 | `PARTNERSHIP_ACCEPTED`、`PROPERTY_BOUGHT` | v0.4.5 | 已验证 | 可直接驱动演出 |
| v0.5.0 首版视觉仍需收敛 | 用户要求 Toast 非胶囊、动画更精致、格子去色条/左上标签、项目显示金额、掷骰回到底栏，并为两类高光增加音效 | 2026-10-08 / v0.5.0-v1 | 已验证 | 覆盖首版视觉选择 |
| v0.5.0 动态反馈存在遮挡 | 用户指出金币与文字重叠，并要求一并检查其他内容 | 2026-10-08 / v0.5.0-v2 | 已验证 | 金币使用玩家栏与棋盘之间的独立轨道；对局 Toast 占用“最近动态”面板；价格、名称、角标和庆祝人物均增加无重叠门禁 |
| v0.5.0 最终可读性与路线方向 | 用户指出金额/名称仍覆盖、字体层级不统一、两条岔路逐节点方向不清，并明确授权完成后发布 | 2026-10-08 / v0.5.0-v3 | 已验证 | 金额/名称独立行且同字号字重；统一同级文本；扩大移动端棋盘；水线/地铁逐段使用高对比底线和方向箭头 |
| v0.5.0 路线过度表达 | 用户指出逐段箭头不好看，左下水线上下折返、节点聚团 | 2026-10-09 / 线上 v0.5.0 | 已验证 | v0.5.1 删除箭头，每条路线仅保留一条连续色线与同色“入/出”端点；两条岔路改为规则弧线并增加曲折度/转角/最小间距门禁 |
| 投资循环不足且口径漂移 | 45 格中仅 17 格可投资，庆祝文案仍使用“买下/购买”；5 个地标大多只给少量打卡奖励 | 2026-10-09 / 线上 v0.5.0 与当前代码 | 已验证 | 4 个地标型节点改为可投资项目，项目增至 21；用户可见口径统一为“投资”；保留地标奖励提高到 100 金币 + 2 影响力 |
| 房间 941415 岔路后卡死根因 | v1.2 四名玩家均缺 `items`；seq248–252 事件已写，随后 P2 Bot 读取 `player.items.length` 抛 TypeError，发生在 persist 前，因此 snapshot 停在 seq247 | 2026-10-09 / 生产 DB+事件+journal+生产代码只读复现 | 已验证 | 加载/执行前迁移旧玩家字段；Bot 路径不再假设 items 存在；新增 v1.2 快照回归 |
| 事件与快照存在部分提交 | 旧流程在每个 applyGameCommand 内先 appendEvents，再运行全部 Bot 并 persist；Bot 异常会留下 event maxSeq > room.seq | 2026-10-09 / 房间 941415 seq247 vs event252 | 已验证 | 全部人类+Bot 命令先在内存完成，再在单一 SQLite transaction 中提交 events+snapshot；失败整体回滚；提交基线取 max(room.seq,event.seq) |
| 岔路存在永久等待风险 | 人类路线选择只有前端弹窗，无服务端超时兜底；旧快照缺 `choices` 或 `movement` 时会访问 undefined | 2026-10-09 / core + server | 已验证 | pending 保存 remaining；旧快照可重建 choices/movement；15 秒未选择自动走默认路线；错误后强制 resume |
| 快照全量写缺少单调保护 | connection/close 等路径会整份 saveRoom；本次没有证据证明其把252回退为247，但它仍是并发风险 | 2026-10-09 / store + 生产只读结论 | 已验证 | 所有 WebSocket membership 写入进入 room queue；saveRoom 拒绝 version/seq 回退；测试覆盖 stale write |
| 微信后台恢复音效不完整 | 骰子使用 HTMLAudio，其他音效使用 Web Audio；原实现只在首次 pointerdown 解锁一次，AudioContext 被微信 suspend 后没有生命周期恢复 | 2026-10-09 / `public/app.js` | 已验证 | visibilitychange/pageshow/focus 与每次手势均 rearm，closed context 自动重建，并用 E2E suspend→resume 门禁验证 |
| 提示与金币动线不符合注意力位置 | Toast 位于最下方；金币在玩家栏下方轨道运行 | 2026-10-09 / 用户现场反馈 | 已验证 | Toast 移到玩家栏正下方独立 34px 提示轨；11 枚金币以约 2.1 秒从付款头像飞向收款头像 |
| 进入旧房后像是“替本人自动行动” | 941415 在 11:20:19 由过期 route pending 的 `timeout-*` 自动选路，随后 3 个真实 Bot 在同一事务产生 23 条事件；用户本人没有 v0.5.1 trustee 动作 | 2026-10-09 / 生产 rooms+game_events 只读时间线 | 已验证 | 保留路线超时语义；客户端先同步状态、可取消展示队列，避免把同批 Bot 历史事件误认为实时替本人行动 |
| 多次结束本局才生效 | 941415 动画队列播放期间 room version 从71跳到77；客户端 snapshot/rejection 排在展示队列后，END_GAME 携带旧 version，最符合 STALE_VERSION；两房最终各有一次房主成功结束 | 2026-10-09 / 生产事件 + 代码路径 | 已验证 | 服务端 END_GAME 忽略 stale version 且 finished 后幂等 ack；客户端提交后禁用按钮，GAME_FINISHED 抢占并取消旧展示队列 |
| 返回首页后仍有骰子声与 Toast | 服务端离页后无新增事件；全局 messageQueue 仍逐条 await 23 条旧事件，goHome 未取消队列/动画/音效/Toast | 2026-10-09 / 生产事件截止时间 + 客户端代码 | 已验证 | event generation token、按房间 lastSeq、goHome 全量取消 socket/队列/dice/movement/coin/celebration/Toast/WebAudio，E2E 验离页后 trace 不再增长 |
| 多连接存在误托管隐患 | 旧 socket close 不检查同 user/room 新 socket，可能写 connected=false 并启动 trustee timer；本次三房均单人类，未实际命中 | 2026-10-09 / server 代码 + 生产状态 | 已验证 | socket 增加 user/connection 身份；仅最后一个活跃 socket close 才断连/启动 timer；timer fire 再检查活跃 socket；增加脱敏审计日志 |

## 需求探索矩阵

| 维度 | 状态 | 影响 | 事实 | 证据 | 假设 | 证伪动作 | 决策人 | 验收方法 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 对象锚定 | PASS | HIGH | 修改当前 H5 的状态机兜底、投资棋盘、音效生命周期和反馈布局；生产取证限定房间 941415 | 用户房间码、DOM、core/server | 无 | 生产只读取证 + 文件审计 | TRAE | 单测/E2E/截图 |
| 术语和业务规则 | PASS | HIGH | “结束”指结束整局并按当前分数结算；沿用房主控制开局/Bot 的权限模式，因此仅房主可结束 | 现有 owner 权限体系 | 普通玩家仍可点首页离开，但不能结束他人整局 | 非房主 END_GAME 必须被拒绝 | 姚怡斌 | 正反权限用例 |
| 验收样例 | PASS | HIGH | 最新十条反馈均有可见或可测断言 | 用户原始清单 | 无 | 生产房间证据、截图、音效 trace、状态机测试 | 姚怡斌 | 本地候选验收 |
| 上游数据准备度 | N/A | LOW | 不新增业务数据源 | 现有 room/game snapshot | 无 | N/A | TRAE | N/A |
| 活参考链路 | PASS | MEDIUM | v0.5.0 线上稳定，事件流和 E2E 可复用 | 当前发布证据与代码 | 无 | 完整 E2E | TRAE | 回归 |
| 失败半径和控制 | PASS | HIGH | 涉及超时自动决策与投资节点转换，但不改骰子概率、经济公式或 DB 结构；线上保持 v0.5.0 | 状态机与线上 v0.5.0 基线 | 默认路线取 choices[0] | 单测覆盖旧快照、超时和中途结束；未获新授权不得发布 | TRAE | 无线上写入 |
| 变更传播 | PASS | MEDIUM | core/server/client/CSS/生成素材/测试/版本文档均受影响 | 依赖扫描 | 无 | 打包前清单 | TRAE | diff 与测试 |

## 推荐路径

- 推荐方案: v0.5.2 本地候选；保留 v0.5.1 全部产品合同，只修改生命周期：同 user/room 活跃 socket 计数防误托管；END_GAME stale-safe + finished 幂等；状态同步优先于展示队列；按房间保存 lastSeq；离页/切房用 generation 取消旧消息、动画、Toast 和音效；GAME_FINISHED 终止旧播放；增加 ws/timer/rejection 脱敏日志
- 推荐理由: 同时解决线上卡死风险与大富翁核心投资密度，反馈位置和声音都绑定真实事件；不新增网络素材、表结构或经济公式
- 什么证据会证明推荐错误: 941415 根因与当前假设冲突；默认路线选择造成非法状态；任一节点非方形或重叠；可投资项目少于 21；Web Audio suspend 后不能恢复；金币端点不是头像中心；路线仍自交/急回头；既有 E2E 回归
- 备选方案: 合作/购买使用完整预渲染视频；表现更复杂但无法动态嵌入玩家头像且包体更大，不推荐
- 当前成熟度允许的动作: 冻结唯一工件、独立 fresh/基线门禁与受控发布；任一真实合同失败立即回滚 v0.5.1

## 拍板队列

| 优先级 | 待决策问题 | 推荐方案 | 证据/理由 | 备选方案 | 延迟风险 | 决策人 | 最晚决策点 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 结束整局由谁操作 | 仅房主，二次确认，按当前城市分结算 | 与开局/Bot 管理权限一致，避免误结束他人对局 | 全员投票结束 | 已采用可回滚默认 | 姚怡斌 | 候选验收 |
| 2 | 帧动画使用范围 | 只用于合伙握手与购买项目；动态头像由 DOM 实时叠加 | 能适配任意玩家组合，包体小 | 每种头像组合单独生图 | 组合爆炸 | 姚怡斌 | 候选验收 |

## 验收计划

- 环境和数据: 生产房间 869517/941415/367422 只读 rooms/events/journal；本地 Chromium 390×844；同用户双 socket；stale/repeated END_GAME；23 条长事件批次离页取消
- 正例: v1.2 缺 items 快照可被 Bot 正常接管；事件序列化失败时 events 与 room 均不推进；stale room write 被拒绝；15 秒路线超时自动前进；缺 choices/movement 的旧快照可恢复；房主在 route pending 中结束成功；21+ 投资格；45 格全方形；Toast 位于玩家栏下；daily/landmark/transit/opportunity/review/vote/route/card/coin 音效 trace 不同；AudioContext suspend→visible 后 running；金币起终点为头像中心且持续约 2.1 秒
- 反例: 路线永久停在 decision；结束本局出现 undefined；任何节点长宽不同；仍出现“购买/买下”文案；Toast 位于底部；切后台后 Web Audio 仍 suspended；金币经过文字或未到头像
- 比较字段/行为: 命令权限、event payload、DOM disabled/hidden、动画 trace、sprite 请求数、console errors、asset budget
- 容差/性能目标: 骰子音效 0.55–0.75 秒；头像金币流 1.9–2.2 秒；合作/投资演出 1.1–1.6 秒；事件音效 trace 分型；新增资产为 0；现有精灵总包体小于 180KB
- 验收证据工件: `artifacts/gameplay-experience-v0.5.1/`

## 变更控制

- 正确基准: 线上 v0.5.1 release `/opt/hangzhou-partners/releases/v0.5.1-20261009T030150Z`
- 回滚点: `/opt/hangzhou-partners/releases/v0.5.1-20261009T030150Z`
- 受影响的仓库/任务/文档: game-core、server、public、scripts、tests、README、IMPLEMENTATION-STATUS
- 需求包差异广播对象: 姚怡斌
- 确认记录: 用户于 2026-10-09 阅读完整根因、修复和25/25+E2E证据后回复“确认”，授权发布 v0.5.2
- 停止条件: 任一权威权限、状态同步、动画方向、资源预算或既有 E2E 失败

## 质疑复核

- 是否需要: yes
- 触发原因: 线上真实故障与状态机超时行为；由 My Mac 只读取证，发布前再次独立复核
- 已发现反例: 现有金币 trace 通过但用户不可见；说明不能以 trace 代替视觉验收
- 缺失证据: 唯一工件 SHA、fresh 门禁、生产 v0.5.1 基线与切换后公网生命周期合同；由 My Mac 独立补齐
- 已删除的不必要设计: 不为四头像组合生成成套视频；不改变经济规则；不把所有动画都做成帧动画
- 评审结论: 用户已授权；唯一工件与生产生命周期门禁全绿后可保留 v0.5.2，否则回滚 v0.5.1
