/**
 * 文档向量化（稠密检索腿·离线部分）
 * - 模型：Xenova/bge-small-zh-v1.5（BGE 中文小模型 ONNX 量化版，512 维，经 hf-mirror 下载）
 * - 产物：evals/doc_vectors.json（{ question: [512维], _meta }），供评测与混合检索复用
 * - 运行：node evals/embedDocs.js  （首次运行会下载 ~30MB 模型）
 * - 向量化内容与稀疏腿一致：question + answer + tags
 */
const fs = require("fs");
const path = require("path");

// HuggingFace 官方源在国内不可达，走镜像（v3 需显式设 remoteHost，仅环境变量不生效）
const { pipeline, env } = require("@huggingface/transformers");
env.remoteHost = process.env.HF_ENDPOINT || "https://hf-mirror.com";

const SEEDS_DIR = path.join(__dirname, "../cloudfunctions/deepseekProxy/seeds");
const OUT = path.join(__dirname, "doc_vectors.json");
const MODEL_ID = "Xenova/bge-small-zh-v1.5";

function loadDocs() {
  const docs = [];
  for (const f of fs.readdirSync(SEEDS_DIR).filter((n) => n.endsWith(".jsonl"))) {
    for (const line of fs.readFileSync(path.join(SEEDS_DIR, f), "utf8").split("\n")) {
      const t = line.trim();
      if (t) docs.push(JSON.parse(t));
    }
  }
  return docs;
}

(async () => {
  console.log(`加载模型 ${MODEL_ID}（首次运行下载 ~30MB）...`);
  const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });

  const docs = loadDocs();
  console.log(`待向量化文档：${docs.length} 条`);

  const vectors = {};
  const startedAt = Date.now();
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    const text = `${d.question} ${d.answer} ${(d.tags || []).join(" ")}`.slice(0, 900);
    const out = await extractor(text, { pooling: "cls", normalize: true });
    vectors[d.question] = Array.from(out.data);
    if ((i + 1) % 40 === 0) console.log(`进度 ${i + 1}/${docs.length}`);
  }

  const dim = Object.values(vectors)[0].length;
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        _meta: {
          model: MODEL_ID,
          dim,
          pooling: "cls",
          normalized: true,
          docCount: Object.keys(vectors).length,
          costMs: Date.now() - startedAt,
          createdAt: new Date().toISOString(),
        },
        vectors,
      },
      null,
      1,
    ),
  );
  console.log(`完成：${Object.keys(vectors).length} 条 × ${dim} 维，耗时 ${Date.now() - startedAt}ms → ${OUT}`);
})().catch((err) => {
  console.error("向量化失败:", err.message || err);
  process.exit(1);
});
