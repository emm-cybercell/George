/**
 * 分层记忆系统（hello-agents Ch8 对应实现）
 * - 工作记忆：会话窗口内的对话（context.js 的 buildMessages 裁剪）
 * - 情景记忆：learning_digests 学习小结（跨会话）
 * - 语义记忆：users 档案画像（年级/培养方向/近期话题）
 * 本模块负责：跨会话记忆的召回（新对话自动注入相关历史）与画像读取
 */

/**
 * 读取语义记忆：用户画像
 * @returns {Promise<{grade: string, ability: string, recentTopics: string[]}>}
 */
async function recallProfile(db, openid) {
  try {
    const res = await db
      .collection("users")
      .where({ _openid: openid })
      .orderBy("updateTime", "desc")
      .limit(1)
      .get();
    const g = res.data?.[0]?.growth || {};
    return {
      grade: res.data?.[0]?.profile?.grade || "",
      ability: g.currentAbility || "",
      recentTopics: g.recentTopics || [],
    };
  } catch {
    return { grade: "", ability: "", recentTopics: [] };
  }
}

/**
 * 情景记忆召回：学习小结中与当前话题相关的条目（简单话题交集打分，取前 2）
 * @param {string[]} topics 当前用户最近话题（作为召回锚点）
 */
async function recallDigests(db, openid, topics, topN = 2) {
  try {
    const res = await db
      .collection("learning_digests")
      .where({ _openid: openid })
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();
    const digests = (res.data || []).map((d) => ({
      summary: String(d.summary || "").slice(0, 60),
      topics: d.topics || [],
      createdAt: d.createdAt,
    }));
    if (digests.length === 0) return [];
    const anchors = new Set(topics);
    return digests
      .map((d) => ({
        ...d,
        score: d.topics.reduce((n, t) => n + (anchors.has(t) ? 1 : 0), 0),
      }))
      .sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)
      .slice(0, topN)
      .map((d) => `${d.summary}（话题：${d.topics.join("/")}）`);
  } catch {
    return [];
  }
}

/**
 * 情景记忆召回（文本锚点版）：以最近用户输入为锚，小结话题被文本命中则计分
 * 与 recallDigests 的区别：无需预抽取的话题列表，直接服务 ReAct 循环入口
 */
async function recallRelevantDigests(db, openid, recentText, topN = 2) {
  try {
    const text = String(recentText || "");
    if (!text) return [];
    const res = await db
      .collection("learning_digests")
      .where({ _openid: openid })
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();
    return (res.data || [])
      .map((d) => ({
        summary: String(d.summary || "").slice(0, 60),
        topics: d.topics || [],
        createdAt: d.createdAt,
      }))
      .map((d) => ({
        ...d,
        score: d.topics.filter((t) => t && text.includes(t)).length,
      }))
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)
      .slice(0, topN)
      .map((d) => `${d.summary}（话题：${d.topics.join("/")}）`);
  } catch {
    return [];
  }
}

module.exports = { recallProfile, recallDigests, recallRelevantDigests };
