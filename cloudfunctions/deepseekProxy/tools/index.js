/**
 * 标准工具集合：Function Calling 定义 + 云端执行器
 * 直接操作云数据库 users / works 集合
 */

/** 工具 JSON Schema 定义（随请求发给模型） */
const TOOL_DEFINITIONS = [
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

/** 积分钳制在 5~15 且保证为整数 */
function clampPoints(p) {
  const n = Math.round(Number(p));
  if (!Number.isFinite(n)) return 5;
  return Math.max(5, Math.min(15, n));
}

/** 标题截断 12 字 */
function titleOf(t) {
  const s = String(t || "未命名作品").trim();
  return s.length > 12 ? s.slice(0, 12) : s;
}

/** 工具执行器映射：接收 { db, openid, args } */
const TOOL_EXECUTORS = {
  /**
   * 思考成长激励：高分提问 +points，同步 users 集合（无档案则新建）
   */
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
        // 兜底：取最近一条档案更新（兼容旧版无 _openid 记录）
        try {
          const q = await col.orderBy("updateTime", "desc").limit(1).get();
          targetId = q.data?.[0]?._id || null;
        } catch (err) {
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

  /**
   * 作品自主归档：写入 works 集合
   */
  save_creative_portfolio: async ({ db, openid, args }) => {
    const title = titleOf(args.title);
    const category = ["story", "idea", "science"].includes(args.category)
      ? args.category
      : "idea";
    const content = String(args.content || "").slice(0, 2000);
    try {
      await db.collection("works").add({
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

module.exports = { TOOL_DEFINITIONS, TOOL_EXECUTORS };
