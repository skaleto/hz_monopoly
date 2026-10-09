# M2：v0.6.2 发布候选

v0.6.1 fresh release 门禁因 E2E 在骰子 impact 合法触发前读取 trace 而停止，未创建或切换生产 release。v0.6.2 仅将该测试改为显式等待 `diceImpact` trace（最长4秒），其余产品代码与 v0.6.1 一致。
