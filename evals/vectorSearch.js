/**
 * 稠密向量检索腿（评测侧复用模块）
 * - 加载 evals/doc_vectors.json（离线向量化的文档库）
 * - 查询侧：同模型实时 embedding（transformers.js，HF 镜像）
 * - 检索：归一化向量点积（即余弦相似度），全量内存扫描
 * 依赖 @huggingface/transformers（devDependency，仅评测/离线用，不进云函数）
 */
const fs = require("fs");
const path = require("path");

process.env.HF_ENDPOINT = process.env.HF_ENDPOINT || "https://hf-mirror.com";
const { pipeline, env } = require("@huggingface/transformers");
env.remoteHost = process.env.HF_ENDPOINT;

const VEC_FILE = path.join(__dirname, "doc_vectors.json");
const MODEL_ID = "Xenova/bge-small-zh-v1.5";

let _extractor = null;
let _store = null;

/** 延迟加载向量库文件 */
function loadVectorStore() {
  if (!_store) {
    if (!fs.existsSync(VEC_FILE)) {
      throw new Error(`缺少向量库 ${VEC_FILE}，请先运行 node evals/embedDocs.js`);
    }
    _store = JSON.parse(fs.readFileSync(VEC_FILE, "utf8"));
    console.log(
      `向量库加载：${_store._meta.docCount} 条 × ${_store._meta.dim} 维（${_store._meta.model}）`,
    );
  }
  return _store;
}

/** 延迟加载 embedding 管线（首次 ~1-3s，后续毫秒级） */
async function getExtractor() {
  if (!_extractor) {
    _extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
  }
  return _extractor;
}

/** 文本 → 归一化向量 */
async function embedText(text) {
  const extractor = await getExtractor();
  const out = await extractor(String(text).slice(0, 900), {
    pooling: "cls",
    normalize: true,
  });
  return Array.from(out.data);
}

/**
 * 稠密检索：查询向量 vs 全部文档向量，余弦 topK
 * @returns {Array<{question, answer, tags, type, score}>}
 */
function vectorSearch(queryVec, topK = 8, threshold = 0) {
  const store = loadVectorStore();
  const hits = [];
  for (const [question, vec] of Object.entries(store.vectors)) {
    let dot = 0;
    for (let i = 0; i < queryVec.length; i++) dot += queryVec[i] * vec[i];
    if (dot >= threshold) hits.push({ question, score: dot });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}

module.exports = { loadVectorStore, embedText, vectorSearch, MODEL_ID };
