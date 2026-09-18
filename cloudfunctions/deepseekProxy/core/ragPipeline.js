/**
 * RAG 增强管线（Phase 2 三件套）
 * 查询改写 → 多路稀疏召回 → RRF 融合 → LLM listwise 重排
 * 说明：当前网关（cloudbase 组）无 embedding 模型，稠密腿以「LLM 语义重排」
 * 替代（见 roadmap 风险预案），评测对比见 evals/retrieval_eval.js，报告如实记录。
 * 全链路可降级：无 LLM / 改写失败 / 重排失败均回退纯稀疏检索结果。
 */
const { searchKnowledge, bumpUsage } = require("./retrieval");

/** RRF 融合常数（论文默认 60） */
const RRF_K = 60;

/** 查询改写：口语化提问 → 检索友好查询 + 同义扩展（失败返回原查询） */
async function rewriteQuery(llm, query) {
  if (!llm || !llm.chatJSON) return { rewritten: query, synonyms: [] };
  try {
    const r = await llm.chatJSON(
      [
        {
          role: "system",
          content:
            '你是检索查询改写器。把学生的口语化提问改写为适合关键词检索的查询，并给出 1-2 个同义表达。只输出 JSON：{"rewritten":"改写后查询","synonyms":["同义1"]}',
        },
        { role: "user", content: query },
      ],
      { temperature: 0.2 },
    );
    return {
      rewritten: String(r.rewritten || "").slice(0, 60) || query,
      synonyms: Array.isArray(r.synonyms)
        ? r.synonyms.slice(0, 2).map((s) => String(s).slice(0, 30)).filter(Boolean)
        : [],
    };
  } catch {
    return { rewritten: query, synonyms: [] };
  }
}

/** 候选去重键：type+question 唯一标识一条知识 */
function docKey(hit) {
  return `${hit.type}|${hit.question}`;
}

/**
 * RRF 融合：score = Σ 1/(k + rank)，多路召回的排名倒数求和
 * @param {Array<Array>} hitLists 各路召回结果（每路已按相关度降序）
 * @param {number} topN 融合后保留数
 */
function rrfFuse(hitLists, topN = 8) {
  const scores = new Map();
  const best = new Map();
  for (const list of hitLists) {
    list.forEach((hit, i) => {
      const key = docKey(hit);
      scores.set(key, (scores.get(key) || 0) + 1 / (RRF_K + i + 1));
      if (!best.has(key)) best.set(key, hit);
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, rrfScore]) => {
      const hit = best.get(key);
      return {
        ...hit,
        score: Math.round((hit.score + rrfScore) * 1000) / 1000,
        rrfScore: Math.round(rrfScore * 10000) / 10000,
      };
    });
}

/**
 * LLM listwise 重排：单次调用给全部候选打相关性分，重排取 topK
 * 失败/未变动时回退 RRF 顺序（可用性优先）
 */
async function rerank(llm, query, candidates, topK) {
  if (!llm || !llm.chatJSON || candidates.length <= 1) {
    return candidates.slice(0, topK);
  }
  try {
    const listing = candidates
      .map(
        (c, i) =>
          `${i + 1}. ${c.question}：${String(c.answer).slice(0, 80)}`,
      )
      .join("\n");
    const r = await llm.chatJSON(
      [
        {
          role: "system",
          content:
            '你是检索相关性评估器。针对查询给每个候选知识条目打相关性分（0-10，10=直接回答了查询）。只输出 JSON：{"scores":[{"id":1,"score":8},{"id":2,"score":3}]}',
        },
        { role: "user", content: `【查询】${query}\n【候选】\n${listing}` },
      ],
      { temperature: 0.1 },
    );
    const byId = new Map(
      (r.scores || []).map((s) => [Number(s.id), Number(s.score)]),
    );
    if (!byId.size) return candidates.slice(0, topK);
    return [...candidates]
      .map((c, i) => ({ ...c, rerankScore: byId.has(i + 1) ? byId.get(i + 1) : -1 }))
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topK)
      .map(({ rerankScore, ...c }) => ({
        ...c,
        // 融合展示分：稀疏分 + 重排分归一，量级与纯稀疏可比
        score: Math.round((c.score + rerankScore / 10) * 1000) / 1000,
      }));
  } catch {
    return candidates.slice(0, topK);
  }
}

/**
 * 增强检索入口：search_knowledge 工具在持有 LLM 客户端时走本管线
 * @returns {Promise<Array>} 与 searchKnowledge 同构的命中数组（含 id/question/answer/tags/type/source/score）
 */
async function retrieveEnhanced(db, llm, query, opts = {}) {
  const { topK = 3, ...rest } = opts;
  // ① 查询改写
  const { rewritten, synonyms } = await rewriteQuery(llm, query);
  const legBQuery = [rewritten, ...synonyms].filter(Boolean).join(" ");

  // ② 多路稀疏召回（改写路 = 原查询时不重复召回）
  const [legA, legB] = await Promise.all([
    searchKnowledge(db, query, { ...rest, topK: 8, skipUsage: true }),
    legBQuery === query
      ? Promise.resolve([])
      : searchKnowledge(db, legBQuery, { ...rest, topK: 8, skipUsage: true }),
  ]);

  // ③ RRF 融合
  const fused = rrfFuse([legA, legB].filter((l) => l.length), 8);
  if (!fused.length) return [];

  // ④ LLM 语义重排 → topK
  const ranked = await rerank(llm, query, fused, topK);
  bumpUsage(db, ranked); // 只对最终结果计数
  return ranked;
}

module.exports = { retrieveEnhanced, rewriteQuery, rrfFuse, rerank, RRF_K };
