# M2：v0.6.3 发布候选

v0.6.2 在切换后因 SQLite WAL checkpoint 导致主 DB size/mtime 变化而按旧门禁自动回滚，逻辑数据与功能无异常。用户明确要求门禁以正常功能为主并适当放宽。

v0.6.3 产品内容与 v0.6.2 一致。发布硬门禁保留：健康、认证、核心UI/E2E、DB quick_check/schema/逻辑摘要、关键历史房、服务错误与回滚；可证明由 WAL checkpoint 导致的 size/mtime/WAL 变化只记录，不单独阻断。
