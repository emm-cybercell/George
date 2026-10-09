/**
 * Agent 工具系统：JSON Schema 定义 + 三域执行器（知识/成长/作品）
 * 模型看到的 schema 与真正执行的 handler 按工具名一一对应，单一文件维护——
 * 新增工具 = 加一份 schema + 一个执行器函数，循环层零改动
 * 外部复用：mcp-server 直接 require 本文件（一次注册，多端调用）
 */
const { searchKnowledge } = require("./core/retrieval");
const { retrieveEnhanced } = require("./core/ragPipeline");

// ===== JSON Schema 定义（随请求发给模型；description 即决策边界）=====

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description:
        "检索知识库（含思维训练题库、学科常见问题、AI 与科学知识、生图灵感模板）。当用户提问学科知识、数学/科学问题、要谜题或脑筋急转弯、要生图灵感、问'为什么'时，必须先调用本工具检索参考内容，再基于结果回答。回答学科作业类问题时遵循红黄绿原则：给思路引导，不直接给完整答案。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "检索关键词（从用户问题中提炼的核心词，如'分数加法''彩虹原理''脑筋急转弯'）",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_challenge",
      description:
        "为用户推荐一个思维训练挑战或成长任务（谜题/脑筋急转弯/动手实验/周末挑战）。当用户说'无聊''不知道做什么''推荐个挑战''给我出个题'或对话收尾时适合调用。会结合用户的历史话题和培养方向做个性化推荐。",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "可选的兴趣方向关键词（如'数学''科学实验'），不传则根据用户画像推荐",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_session",
      description:
        "当一轮学习结束时（用户表示理解了/道谢/结束话题），且本轮对话有实质学习内容时调用，生成 40 字以内的学习小结并归档。小结要突出：今天探索了什么、有什么收获。",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "学习小结（40 字以内，面向孩子的鼓励语气）",
          },
          topics: {
            type: "array",
            items: { type: "string" },
            description: "本轮涉及的话题标签（2-4 个，如['分数','推理']）",
          },
        },
        required: ["summary", "topics"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "award_growth_points",
      description:
        "当识别到用户提出了深刻、富有好奇心、批判性思维或逻辑严密的高质量问题/反思时调用，为用户发放探索积分。",
      parameters: {
        type: "object",
        properties: {
          points: {
            type: "number",
            description: "奖励积分数，范围 5~15",
            minimum: 5,
            maximum: 15,
          },
          reason: { type: "string", description: "简短加分原因" },
        },
        required: ["points", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_creative_portfolio",
      description:
        "当识别到用户在对话中完成了一篇完整的故事创作、创意方案、科幻设想或逻辑推理产出时调用，将其归档到云端作品集。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "提炼的作品标题（12字以内）" },
          category: { type: "string", enum: ["story", "idea", "science"] },
          content: { type: "string", description: "作品核心内容全文" },
        },
        required: ["title", "category", "content"],
      },
    },
  },
];

// ===== 知识域执行器 =====

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

// ===== 成长激励域执行器 =====

/** 积分钳制在 5~15 且保证为整数 */
function clampPoints(p) {
  const n = Math.round(Number(p));
  if (!Number.isFinite(n)) return 5;
  return Math.max(5, Math.min(15, n));
}

/** 成长激励：高分提问 +points（增量更新，避免整文档覆盖竞态） */
const GROWTH_EXECUTORS = {
  award_growth_points: async ({ db, openid, args }) => {
  const points = clampPoints(args.points);
  const reason = String(args.reason || "").slice(0, 60);
  try {
    const col = db.collection("users");
    // 优先按 _openid 查当前用户档案，否则取最新一条
    let targetId = null;
    try {
      const q = await col
        .where({ _openid: openid })
        .orderBy("updateTime", "desc")
        .limit(1)
        .get();
      targetId = q.data?.[0]?._id || null;
    } catch (err) {
      console.warn("award: query by openid failed", err.message || err);
    }
    if (!targetId) {
      try {
        const q = await col.orderBy("updateTime", "desc").limit(1).get();
        targetId = q.data?.[0]?._id || null;
      } catch {
        /* 忽略查询失败 */
      }
    }
    if (targetId) {
      await col.doc(targetId).update({
        data: {
          "growth.points": db.command.inc(points),
          updateTime: Date.now(),
        },
      });
      return { success: true, points, reason, applied: "inc" };
    }
    // 无任何档案：新建一份（含当前 openid）
    await col.add({
      data: {
        _openid: openid,
        profile: { nickName: "新星创造者", grade: "3-4年级 (中段探索)" },
        growth: { points, level: 1, currentAbility: "", unlockedBadges: [] },
        updateTime: Date.now(),
      },
    });
    return { success: true, points, reason, applied: "created" };
  } catch (err) {
    console.error("award_growth_points error:", err);
    return { success: false, error: String(err.message || err) };
  }
},
};

// ===== 作品归档域执行器 =====

/** 标题截断 12 字 */
function titleOf(t) {
  const s = String(t || "未命名作品").trim();
  return s.length > 12 ? s.slice(0, 12) : s;
}

const PORTFOLIO_EXECUTORS = {
  /** 作品自主归档 */
  save_creative_portfolio: async ({ db, openid, args }) => {
    const title = titleOf(args.title);
    const category = ["story", "idea", "science"].includes(args.category)
      ? args.category
      : "idea";
    const content = String(args.content || "").slice(0, 2000);
    try {
      await db.collection("creative_works").add({
        data: {
          _openid: openid,
          title,
          category,
          mediaType: "text",
          content,
          abilityMode: "",
          createTime: Date.now(),
        },
      });
      return { success: true, title, category };
    } catch (err) {
      console.error("save_creative_portfolio error:", err);
      return { success: false, error: String(err.message || err) };
    }
  },
};

// ===== 汇总映射（registry / agentRunner / MCP 统一消费）=====

const TOOL_EXECUTORS = {
  ...KNOWLEDGE_EXECUTORS,
  ...GROWTH_EXECUTORS,
  ...PORTFOLIO_EXECUTORS,
};

module.exports = { TOOL_DEFINITIONS, TOOL_EXECUTORS };
