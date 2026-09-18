# 检索评测 · 首轮对比报告（2026-09-18）

## 结论

查询改写 + 多路召回 + RRF 融合 + LLM 重排的增强管线，相对纯稀疏（TF-IDF）基线：

| 指标 | 纯稀疏基线 | 增强管线 | 提升 |
|---|---|---|---|
| Recall@1 | 0.392 | **0.904** | +51.2pp |
| Recall@3 | 0.590 | **0.928** | +33.8pp |
| Recall@5 | 0.657 | **0.928** | +27.1pp |
| MRR | 0.511 | **0.918** | +40.7pp |

## 评测设置

- **语料**：知识库种子 166 条（faq 58 / quiz 54 / missions 22 / prompts 32）
- **黄金集**：166 条，每条由 hy3 模拟 8-14 岁学生口语化提问生成（与原条目用词明显不同的同义改写），`query → 期望文档` 单标注
- **指标**：Recall@K（期望文档进入 topK 的比率）、MRR（期望文档排名倒数均值）
- **管线**：
  - 基线 `sparse_baseline`：bigram 分词 TF-IDF 余弦 + 标签/培养方向加权（线上原链路）
  - 增强 `enhanced_rewrite_rrf_rerank`：①hy3 查询改写+同义扩展 → ②原查询/改写查询双路稀疏召回（各 top8）→ ③RRF 融合（k=60）→ ④hy3 listwise 相关性重排（0-10 分）取 topK
- **成本**：增强管线每次检索增加 2 次 hy3 调用（改写 + 重排），免费资源包额度内

## 已知限制（如实记录）

1. **稠密腿现状**：CloudBase 网关 `cloudbase` 组当前不提供 embedding 模型（探测 4 个常见模型名均 403 AI_MODEL_NOT_SUPPORTED），本版稠密语义以「LLM listwise 重排」替代；升级真 embedding 时只需在 `ragPipeline.js` 增加一路向量召回。
2. **单标注黄金集**：每条查询仅一个期望文档；知识库存在多条相关时（如多个数学条目）召回其他相关条目会被判 miss，真实 Recall 略被低估。
3. **评测与线上差异**：评测直查本地种子数组，线上链路含云数据库拉取与用户材料合并，指标不含该延迟。

## 文件

- 黄金集：`evals/golden_set.jsonl`
- 复现：`node evals/retrieval_eval.js`（基线）/ `node evals/retrieval_eval.js --llm`（增强，需 CB_GATEWAY_* 环境变量）
- 分报告：`2026-09-18-sparse_baseline.md` / `2026-09-18-enhanced_rewrite_rrf_rerank.md`
