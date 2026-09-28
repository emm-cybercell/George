/**
 * RAG 检索管线 v2（评测驱动重构，2026-09-28）
 * 主路径：稠密召回（embedding 服务）→ LLM listwise 重排 → topK
 * 降级链：embedding 服务不可用 → 稀疏 top8 + LLM 重排；无 LLM → 纯稀疏
 * 依据 evals/reports/2026-09-28-dense-leg.md：稠密+1次重排 Recall@3 0.982，
 * 优于旧"改写+双路RRF+重排"（0.928）且 LLM 成本减半；弱稀疏腿融合反而损害头部精度。
 * 旧组件（rewriteQuery/rrfFuse）保留导出供评测脚本复现历史方案。
 */
const axios = require("axios");
const { searchKnowledge, bumpUsage } = require("./retrieval");

/** RRF 融合常数（历史方案使用，保留） */
const RRF_K = 60;
/** 向量库缓存 TTL（与检索服务壳一致） */
const VEC_TTL_MS = 5 * 60 * 1000;

let vecCache = { docs: null, loadedAt: 0 };

/** 余弦相似度（已归一化向量，点积即余弦） */
function cosine(a, b) {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * 稠密排序（纯函数，可单测）
 * @param {number[]} queryVec 查询向量
 * @param {Array<{id,question,answer,tags,type,source,vec}>} docVecs 文档向量记录
 * @param {number} topK
 */
function denseRank(queryVec, docVecs, topK = 8) {
  return docVecs
    .map((d) => ({ ...d, score: Math.round(cosine(queryVec, d.vec) * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ vec, ...rest }) => rest);
}

/** embedding 服务客户端（HTTP 薄封装，失败返回 null 走降级） */
async function embedText(text) {
  const url = process.env.EMBEDDING_SVC_URL;
  if (!url) return null;
  try {
    const res = await axios.post(
      `${url}/embed`,
      { text },
      { headers: { "X-API-Key": process.env.EMBEDDING_SVC_KEY || "" }, timeout: 5000 },
    );
    return Array.isArray(res.data?.embedding) ? res.data.embedding : null;
  } catch (err) {
    console.warn("embedding 服务不可用，降级稀疏检索:", err.message || err);
    return null;
  }
}

/** 文档向量库：kb_embeddings 集合（5 分钟 TTL；兼容 node-sdk 的 {_id,data} 包裹格式） */
async function loadVectorizedDocs(db) {
  if (vecCache.docs && Date.now() - vecCache.loadedAt < VEC_TTL_MS) return vecCache.docs;
  try {
    const res = await db.collection("kb_embeddings").limit(500).get();
    vecCache = {
      docs: (res.data || []).map((d) => (d && d.data && d._id ? d.data : d)),
      loadedAt: Date.now(),
    };
    return vecCache.docs;
  } catch {
    return [];
  }
}

/** 失效向量缓存（知识库重建向量后调用） */
function invalidateVectorCache() {
  vecCache = { docs: null, loadedAt: 0 };
}

/**
 * 检索入口 v2：稠密主路径 + 稀疏降级链
 * @param {*} db 云数据库实例
 * @param {{chatJSON: Function}} llm LLM 客户端（重排用；可空）
 * @param {string} query 用户查询
 * @param {{topK?: number, embedFn?: Function}} opts embedFn 依赖注入（测试用）
 */
async function retrieveEnhanced(db, llm, query, opts = {}) {
  const { topK = 3, embedFn = embedText } = opts;
  const [queryVec, vecDocs] = await Promise.all([
    embedFn(query),
    loadVectorizedDocs(db),
  ]);

  // 主路径：稠密召回 → LLM 重排（1 次调用）
  if (queryVec && vecDocs.length) {
    const denseLeg = denseRank(queryVec, vecDocs, 8);
    if (denseLeg.length) {
      const ranked = llm ? await rerank(llm, query, denseLeg, topK) : denseLeg.slice(0, topK);
      bumpUsage(db, ranked);
      return ranked;
    }
  }

  // 降级：稀疏召回（无 embedding 服务/向量库为空/服务故障）→ LLM 重排或纯稀疏
  const hits = await searchKnowledge(db, query, { ...opts, topK: 8, skipUsage: true });
  if (!hits.length) return [];
  const ranked = llm ? await rerank(llm, query, hits, topK) : hits.slice(0, topK);
  bumpUsage(db, ranked);
  return ranked;
}

/** 查询改写（历史方案组件，保留供评测复现；现管线已不含此步） */
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

/** 候选去重键（历史方案组件，保留） */
function docKey(hit) {
  return `${hit.type}|${hit.question}`;
}

/**
 * RRF 融合（历史方案组件，保留）：score = Σ 1/(k + rank)
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
 * 失败/未变动时回退传入顺序（可用性优先）
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
        // 融合展示分：召回分 + 重排分归一，量级与纯稀疏可比
        score: Math.round((c.score + rerankScore / 10) * 1000) / 1000,
      }));
  } catch {
    return candidates.slice(0, topK);
  }
}

module.exports = {
  retrieveEnhanced,
  rewriteQuery,
  rrfFuse,
  rerank,
  denseRank,
  cosine,
  embedText,
  loadVectorizedDocs,
  invalidateVectorCache,
  RRF_K,
};
