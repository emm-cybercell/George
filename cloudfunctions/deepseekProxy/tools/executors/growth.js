/**
 * 成长激励工具执行器：操作 users 集合
 */

/** 积分钳制在 5~15 且保证为整数 */
function clampPoints(p) {
  const n = Math.round(Number(p));
  if (!Number.isFinite(n)) return 5;
  return Math.max(5, Math.min(15, n));
}

/** 成长激励：高分提问 +points（增量更新，避免整文档覆盖竞态） */
const award_growth_points = async ({ db, openid, args }) => {
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
};

module.exports = { GROWTH_EXECUTORS: { award_growth_points } };
