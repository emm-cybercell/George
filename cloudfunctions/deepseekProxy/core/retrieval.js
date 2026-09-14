/**
 * 知识库检索服务（带副作用壳）
 * - 公共库全量拉取（≤500 条、字段裁剪）+ 实例级 5 分钟 TTL 缓存
 * - 个人材料库（source:user, 按 openid）独立 5 分钟缓存（Map 键含 openid 防串用户）
 * - 命中后异步 usageCount+1（不阻塞返回）
 * - 调优参数支持 system_configs(kb_tuning) 热更，代码内置默认兜底
 */
const { search } = require("./retrievalCore");

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_DOCS = 500;

/** 默认调优参数（kb_tuning 文档可热更覆盖） */
const DEFAULT_TUNING = {
  topK: 3,
  threshold: 0.15,
  tagBoost: 1.5,
};

/** 公共库缓存（全实例共享） */
let publicCache = { docs: null, loadedAt: 0 };
/** 个人材料缓存（openid → docs） */
const userCache = new Map();

/** 调优参数缓存（同实例 5 分钟） */
let tuningCache = { value: null, loadedAt: 0 };

/** 公共库查询字段裁剪 */
const KB_FIELDS = {
  question: true,
  answer: true,
  tags: true,
  type: true,
  abilityIds: true,
  usageCount: true,
  source: true,
};

/**
 * 拉取公共知识库（带缓存）
 * @param {*} db 云数据库实例
 * @returns {Promise<Array|null>} 失败返回 null（调用方降级为不检索）
 */
async function loadPublicDocs(db) {
  if (publicCache.docs && Date.now() - publicCache.loadedAt < CACHE_TTL_MS) {
    return publicCache.docs;
  }
  try {
    const res = await db
      .collection("knowledge_base")
      .field(KB_FIELDS)
      .limit(MAX_DOCS)
      .get();
    publicCache = { docs: res.data || [], loadedAt: Date.now() };
    return publicCache.docs;
  } catch (err) {
    console.warn("knowledge_base 读取失败（检索降级）:", err.message || err);
    return null;
  }
}

/**
 * 拉取当前用户的个人材料（带按 openid 缓存）
 * @returns {Promise<Array>} 失败返回 []
 */
async function loadUserDocs(db, openid) {
  if (!openid) return [];
  const hit = userCache.get(openid);
  if (hit && Date.now() - hit.loadedAt < CACHE_TTL_MS) return hit.docs;
  try {
    const res = await db
      .collection("knowledge_base")
      .where({ openid, source: "user" })
      .field(KB_FIELDS)
      .limit(50)
      .get();
    userCache.set(openid, { docs: res.data || [], loadedAt: Date.now() });
    return res.data || [];
  } catch (err) {
    console.warn("个人材料读取失败:", err.message || err);
    return [];
  }
}

/** 读取调优参数（kb_tuning 文档可选） */
async function loadTuning(db) {
  if (tuningCache.value && Date.now() - tuningCache.loadedAt < CACHE_TTL_MS) {
    return tuningCache.value;
  }
  let value = { ...DEFAULT_TUNING };
  try {
    const res = await db.collection("system_configs").doc("kb_tuning").get();
    if (res.data) {
      value = { ...value, ...res.data };
    }
  } catch {
    /* 无文档走默认 */
  }
  tuningCache = { value, loadedAt: Date.now() };
  return value;
}

/** 失效缓存（知识库内容更新后可手动触发；openid 缺省清全部个人缓存） */
function invalidateCache(openid) {
  if (openid) {
    userCache.delete(openid);
  } else {
    publicCache = { docs: null, loadedAt: 0 };
    userCache.clear();
  }
}

/**
 * 检索知识库（公共 + 当前用户个人材料合并，公共库优先参考个人材料）
 * @param {*} db 云数据库实例
 * @param {string} query 用户查询
 * @param {{topK?:number, threshold?:number, preferTypes?:string[], preferAbilities?:string[], openid?:string}} opts
 * @returns {Promise<Array<{question,answer,tags,type,source,score}>>}
 */
async function searchKnowledge(db, query, opts = {}) {
  const { openid, ...searchOpts } = opts;
  const [publicDocs, userDocs, tuning] = await Promise.all([
    loadPublicDocs(db),
    loadUserDocs(db, openid),
    loadTuning(db),
  ]);
  // 公共库失败但个人材料存在 → 仍可检索个人材料
  const docs = [
    ...userDocs,
    ...(publicDocs || []),
  ];
  if (docs.length === 0) return [];

  const hits = search(query, docs, { ...tuning, ...searchOpts });
  // 异步累计召回统计（不阻塞，失败静默）
  for (const hit of hits) {
    if (hit.doc._id) {
      db.collection("knowledge_base")
        .doc(hit.doc._id)
        .update({
          data: {
            usageCount: (hit.doc.usageCount || 0) + 1,
            lastUsedAt: Date.now(),
          },
        })
        .catch(() => {});
    }
  }
  return hits.map((h) => ({
    question: h.doc.question,
    answer: h.doc.answer,
    tags: h.doc.tags || [],
    type: h.doc.type,
    source: h.doc.source || "seed",
    score: Math.round(h.score * 1000) / 1000,
  }));
}

module.exports = {
  searchKnowledge,
  loadPublicDocs,
  loadUserDocs,
  invalidateCache,
  DEFAULT_TUNING,
};
