# 检索评测报告 · 2026-09-18

- 方案：`langgraph_rewrite_rrf`（LangGraph StateGraph：classify→rewrite→retrieve，RRF 融合）
- 语料：知识库种子 166 条
- 评测查询：黄金集 166 条（与自研轨同一集合）

| 指标 | 数值 |
|---|---|
| Recall@1 | 0.518 |
| Recall@3 | 0.825 |
| Recall@5 | 0.880 |
| MRR | 0.673 |
