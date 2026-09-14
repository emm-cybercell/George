/**
 * RAG 检索核心（纯函数，零依赖，可单测）
 * 向量化方案：中文 bigram + 英数词元的 TF-IDF 余弦相似度（免费套餐零成本实现）
 * 未来升级真 embedding 模型时只需替换本文件接口
 */

/** 判断 CJK 字符（含常用汉字扩展） */
function isCJK(ch) {
  const code = ch.codePointAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf)
  );
}

/**
 * 分词：中文相邻二字 bigram + 英文/数字词元（小写化）
 * "乘法口诀abc" → ["乘法","法口","口诀","abc"]
 */
function tokenize(text) {
  const s = String(text || "").toLowerCase();
  const tokens = [];
  let buffer = "";
  const flushBuffer = () => {
    if (buffer) {
      tokens.push(buffer);
      buffer = "";
    }
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (isCJK(ch)) {
      flushBuffer();
      if (i + 1 < s.length && isCJK(s[i + 1])) {
        tokens.push(ch + s[i + 1]);
      }
    } else if (/[a-z0-9]/.test(ch)) {
      buffer += ch;
    } else {
      flushBuffer();
    }
  }
  flushBuffer();
  return tokens;
}

/** 词频向量：{词元: 次数} */
function termFreq(tokens) {
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  return tf;
}

/** 归一化向量（平方和开根），返回 {词元: 权重} */
function normalize(vec) {
  let sum = 0;
  for (const k in vec) sum += vec[k] * vec[k];
  const norm = Math.sqrt(sum) || 1;
  const out = {};
  for (const k in vec) out[k] = vec[k] / norm;
  return out;
}

/** 余弦相似度：输入两个已归一化向量 */
function cosine(a, b) {
  let dot = 0;
  for (const k in a) {
    if (b[k]) dot += a[k] * b[k];
  }
  return dot; // 已归一化，点积即余弦
}

/**
 * 构建语料库：计算每个文档的归一化 TF-IDF 向量与 IDF 表
 * @param {Array<{question:string, answer:string, tags?:string[]}>} docs
 */
function buildCorpus(docs) {
  const docTokens = docs.map((d) =>
    tokenize(`${d.question} ${d.answer} ${(d.tags || []).join(" ")}`),
  );
  // IDF：文档频率的倒数
  const df = {};
  docTokens.forEach((tokens) => {
    const seen = new Set(tokens);
    for (const t of seen) df[t] = (df[t] || 0) + 1;
  });
  const n = docs.length || 1;
  const idf = {};
  for (const t in df) idf[t] = Math.log((n + 1) / (df[t] + 1)) + 1;

  const vectors = docTokens.map((tokens) => {
    const tf = termFreq(tokens);
    const tfidf = {};
    for (const t in tf) tfidf[t] = tf[t] * (idf[t] || 1);
    return normalize(tfidf);
  });

  return { vectors, idf };
}

/** 文本 → 归一化 TF-IDF 向量（复用语料 IDF） */
function vectorize(text, corpus) {
  const tf = termFreq(tokenize(text));
  const tfidf = {};
  for (const t in tf) tfidf[t] = tf[t] * (corpus.idf[t] || 1.5);
  return normalize(tfidf);
}

/**
 * 检索：TF-IDF 余弦 + 标签命中加权 + 培养方向加权，阈值过滤后取 topK
 * @param {string} query 用户查询
 * @param {Array} docs 文档数组（含 question/answer/tags/type）
 * @param {{topK?:number, threshold?:number, tagBoost?:number, preferTypes?:string[], preferAbilities?:string[]}} opts
 * @returns {Array<{doc:object, score:number}>}
 */
function search(query, docs, opts = {}) {
  const {
    topK = 3,
    threshold = 0.15,
    tagBoost = 1.5,
    preferTypes = null,
    preferAbilities = null,
  } = opts;
  if (!query || !docs || docs.length === 0) return [];

  const corpus = buildCorpus(docs);
  const qv = vectorize(query, corpus);
  const queryTokens = new Set(tokenize(query));
  const abilitySet = new Set(preferAbilities || []);

  const scored = docs.map((doc, i) => {
    let score = cosine(qv, corpus.vectors[i]);
    // 标签精确命中加权：query 分词与 tag 直接相等或 tag 包含于 query
    for (const tag of doc.tags || []) {
      const tl = String(tag).toLowerCase();
      if (queryTokens.has(tl) || query.includes(tl)) {
        score += tagBoost * 0.1;
        break;
      }
    }
    // 类型偏好加权（如推荐场景 prefer quiz/mission）
    if (preferTypes && preferTypes.includes(doc.type)) {
      score += tagBoost * 0.08;
    }
    // 培养方向加权：文档关联能力与用户方向有交集
    if (abilitySet.size && (doc.abilityIds || []).some((a) => abilitySet.has(a))) {
      score += tagBoost * 0.12;
    }
    return { doc, score };
  });

  return scored
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

module.exports = { tokenize, termFreq, normalize, cosine, buildCorpus, vectorize, search };
