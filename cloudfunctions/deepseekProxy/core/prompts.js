/**
 * Prompt 版本化与灰度发布
 * - prompt_versions 集合：{ promptId, version, content, status: active|gray|disabled, grayPercent }
 *   同一 promptId 可挂多版本；active 唯一（多 active 时取最新 version），gray 按 openid 哈希分桶
 * - DB 优先、代码内置兜底（config.js 同款哲学）：集合不存在/读取失败/无记录 → 回退代码默认值，
 *   主链路永不受灰度系统故障影响
 * - 命中结果记入 trace（version 留痕），灰度效果可在 trace 层直接观察
 */
const PROMPT_COLLECTION = "prompt_versions";

/** 代码内置默认版本（兜底；灰度系统整体不可用时服务照常） */
const BUILTIN_PROMPTS = {
  reflect: { version: 1, content: `你是学习助手"桥智同学"的质检员。依据"AI 作业红黄绿原则"对草稿回答做自检：
- 红色（必须修订）：直接给出作业的完整答案而非引导思考；
- 黄色（允许）：给出提示与引导；
- 绿色（鼓励）：讲解思路与方法。
同时检查：语气是否匹配学生学段、是否有明显事实错误。
只输出 JSON：{"verdict":"pass"或"revise","issues":["问题1","问题2"],"revised":"修订后的完整回答（仅 verdict=revise 时提供）"}
要求：revised 保持原回答的称呼与风格，只修复问题，不得改变结论立场。` },
  plan: { version: 1, content: `你是学习任务的规划器。请针对学生的问题制定 2-4 步的简短执行计划，每步一句话（可包含需要查询的知识点或互动设计）。
只输出 JSON：{"steps":["步骤1","步骤2","步骤3"]}
若问题简单到无需拆解，steps 只给一步即可，不要过度规划。` },
};

/** 5 分钟进程内缓存：灰度规则读取不增加主链路延迟 */
let cache = { docs: null, loadedAt: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000;

/** openid → 0..99 的稳定分桶值（同一用户永远落在同一桶，灰度体验一致） */
function bucketOf(openid) {
  const s = String(openid || "anon");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h % 100;
}

/** 拉取灰度规则（失败返回 null，调用方走兜底） */
async function loadRules(db) {
  if (cache.docs && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.docs;
  try {
    const res = await db.collection(PROMPT_COLLECTION).limit(100).get();
    cache = { docs: res.data || [], loadedAt: Date.now() };
    return cache.docs;
  } catch (err) {
    console.warn("prompt_versions 读取失败，使用内置默认 prompt:", err.message || err);
    return null;
  }
}

/** 失效缓存（管理端改版本后调用；不调则等 TTL 自然过期） */
function invalidatePromptCache() {
  cache = { docs: null, loadedAt: 0 };
}

/**
 * 解析 promptId 当前应生效的版本
 * @returns {{ content: string, version: number, source: "builtin"|"active"|"gray" }}
 */
async function resolvePrompt(db, promptId, openid) {
  const builtin = BUILTIN_PROMPTS[promptId];
  const fallback = builtin
    ? { content: builtin.content, version: builtin.version, source: "builtin" }
    : { content: "", version: 0, source: "builtin" };

  const docs = await loadRules(db);
  if (!docs) return fallback;
  const versions = docs
    .filter((d) => d.promptId === promptId && d.content && d.status !== "disabled")
    .sort((a, b) => (b.version || 0) - (a.version || 0));
  if (!versions.length) return fallback;

  // active 唯一：多 active 时取版本号最高的
  const active = versions.find((d) => d.status === "active");
  if (active) {
    return { content: String(active.content), version: active.version || 0, source: "active" };
  }
  // 无 active 时按 gray 分桶：命中桶内（bucket < grayPercent）则用最高 gray 版本
  const gray = versions.find((d) => d.status === "gray");
  if (gray) {
    const percent = Math.min(Math.max(Number(gray.grayPercent) || 0, 0), 100);
    if (bucketOf(openid) < percent) {
      return { content: String(gray.content), version: gray.version || 0, source: "gray" };
    }
  }
  return fallback;
}

module.exports = {
  BUILTIN_PROMPTS,
  resolvePrompt,
  invalidatePromptCache,
  bucketOf,
  PROMPT_COLLECTION,
};
