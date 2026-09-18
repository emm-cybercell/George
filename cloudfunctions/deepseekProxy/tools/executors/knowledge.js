/**
 * 知识检索 / 推荐 / 摘要类工具执行器
 */
const { searchKnowledge } = require("../../core/retrieval");
const { retrieveEnhanced } = require("../../core/ragPipeline");

/** 截断标签数组为安全长度 */
function safeTags(tags) {
  return Array.isArray(tags) ? tags.slice(0, 5) : [];
}

/** 读取用户画像（培养方向）；查不到返回空串 */
async function getUserAbility(db, openid) {
  try {
    const u = await db
      .collection("users")
      .where({ _openid: openid })
      .orderBy("updateTime", "desc")
      .limit(1)
      .get();
    return u.data?.[0]?.growth?.currentAbility || "";
  } catch {
    return "";
  }
}

const KNOWLEDGE_EXECUTORS = {
/**
 * 知识库检索：公共库+个人材料合并，按培养方向加权，返回 topK 命中
 * 持有 LLM 客户端时走 RAG 增强管线（查询改写+多路召回+RRF+LLM 重排），
 * 否则纯稀疏检索（SDK 托管循环 / 本地降级场景）
 */
  search_knowledge: async ({ db, openid, args, llm }) => {
    const query = String(args.query || "").slice(0, 50);
    if (!query) {
      return { success: false, error: "缺少检索关键词", tags: [] };
    }
    try {
      const ability = await getUserAbility(db, openid);
      const searchOpts = {
        openid,
        ...(ability ? { preferAbilities: [ability] } : {}),
      };
      const hits = llm
        ? await retrieveEnhanced(db, llm, query, searchOpts)
        : await searchKnowledge(db, query, searchOpts);
      if (hits.length === 0) {
        return { success: false, error: "知识库暂无相关内容", tags: [] };
      }
      const tags = [...new Set(hits.flatMap((h) => safeTags(h.tags)))].slice(0, 5);
      return {
        success: true,
        tags,
        results: hits.map((h) => ({
          question: h.question,
          answer: String(h.answer).slice(0, 300),
          type: h.type,
          source: h.source,
          score: h.score,
        })),
      };
    } catch (err) {
      console.error("search_knowledge error:", err.message || err);
      return { success: false, error: String(err.message || err), tags: [] };
    }
  },

  /**
   * 个性化挑战推荐：结合用户培养方向 + 历史话题检索 quiz/mission，
   * 优先 usageCount 低的（探索冷门内容）
   */
  recommend_challenge: async ({ db, openid, args }) => {
    try {
      // 用户画像：培养方向 + 最近话题
      const ability = await getUserAbility(db, openid);
      let recentTopics = [];
      try {
        const u = await db
          .collection("users")
          .where({ _openid: openid })
          .orderBy("updateTime", "desc")
          .limit(1)
          .get();
        recentTopics = u.data?.[0]?.growth?.recentTopics || [];
      } catch {
        /* 无档案用空画像 */
      }
      const topic = String(args.topic || "").slice(0, 20);
      const query = topic || recentTopics[0] || "挑战";
      const hits = await searchKnowledge(db, query, {
        openid,
        preferTypes: ["quiz", "mission"],
        ...(ability ? { preferAbilities: [ability] } : {}),
        topK: 4,
      });
      // 过滤出 quiz/mission 类型，按 usageCount 升序（冷门优先）
      const candidates = hits.filter(
        (h) => h.type === "quiz" || h.type === "mission",
      );
      if (candidates.length === 0) {
        return { success: false, error: "暂时没有合适的挑战", tags: [] };
      }
      const pick = candidates[0];
      return {
        success: true,
        tags: safeTags(pick.tags),
        challenge: {
          question: pick.question,
          hint: String(pick.answer).slice(0, 200),
          difficulty: pick.difficulty || 1,
          matchedAbility: ability || "综合",
        },
      };
    } catch (err) {
      console.error("recommend_challenge error:", err.message || err);
      return { success: false, error: String(err.message || err), tags: [] };
    }
  },

  /** 学习小结归档：写入 learning_digests 集合 */
  summarize_session: async ({ db, openid, args }) => {
    const summary = String(args.summary || "").slice(0, 60);
    const topics = safeTags(args.topics);
    if (!summary) {
      return { success: false, error: "小结内容为空" };
    }
    try {
      await db.collection("learning_digests").add({
        data: {
          _openid: openid,
          summary,
          topics,
          createdAt: Date.now(),
        },
      });
      return { success: true, summary, topics };
    } catch (err) {
      console.error("summarize_session error:", err.message || err);
      return { success: false, error: String(err.message || err) };
    }
  },
};

module.exports = { KNOWLEDGE_EXECUTORS };
