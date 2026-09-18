/**
 * 检索评测：Recall@1/3/5 与 MRR
 * 用法：
 *   node evals/retrieval_eval.js           # 纯稀疏基线（零成本，无需网关）
 *   node evals/retrieval_eval.js --llm     # 增强管线：查询改写+RRF+LLM 重排（走网关）
 * 输出：evals/reports/<date>.md
 */
const fs = require("fs");
const path = require("path");
const { search } = require("../cloudfunctions/deepseekProxy/core/retrievalCore");
const { rewriteQuery, rrfFuse, rerank } = require("../cloudfunctions/deepseekProxy/core/ragPipeline");
const { createLLM } = require("../cloudfunctions/deepseekProxy/core/framework/llm");

const SEEDS_DIR = path.join(__dirname, "../cloudfunctions/deepseekProxy/seeds");
const GOLDEN = path.join(__dirname, "golden_set.jsonl");
const REPORTS_DIR = path.join(__dirname, "reports");

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

function loadGolden() {
  if (!fs.existsSync(GOLDEN)) {
    console.error(`缺少黄金集 ${GOLDEN}，请先运行 node evals/buildGoldenSet.js`);
    process.exit(1);
  }
  return fs
    .readFileSync(GOLDEN, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

/** 纯稀疏检索（评测用：低阈值拿全排序） */
function sparseSearch(query, docs, topK = 10) {
  return search(query, docs, { topK, threshold: 0.01 }).map((h) => h.doc.question);
}

/** 增强管线（与线上 retrieveEnhanced 同构，但面向本地 docs 数组） */
async function enhancedSearch(llm, query, docs, topK = 10) {
  const { rewritten, synonyms } = await rewriteQuery(llm, query);
  const legB = [rewritten, ...synonyms].filter(Boolean).join(" ");
  const mk = (hits) => hits.map((h) => ({ ...h.doc, score: h.score }));
  const legA = mk(search(query, docs, { topK: 8, threshold: 0.01 }));
  const legBHits = legB === query ? [] : mk(search(legB, docs, { topK: 8, threshold: 0.01 }));
  const fused = rrfFuse([legA, legBHits].filter((l) => l.length), 8);
  if (!fused.length) return [];
  const ranked = await rerank(llm, query, fused, 10);
  return ranked.map((h) => h.question);
}

function metrics(ranked, expected, k = 10) {
  const hitAt = (n) => (ranked.slice(0, n).includes(expected) ? 1 : 0);
  let rr = 0;
  const idx = ranked.slice(0, k).indexOf(expected);
  if (idx >= 0) rr = 1 / (idx + 1);
  return { r1: hitAt(1), r3: hitAt(3), r5: hitAt(5), mrr: rr };
}

function fmt(metricsList) {
  const n = metricsList.length || 1;
  const sum = metricsList.reduce(
    (a, m) => ({
      r1: a.r1 + m.r1,
      r3: a.r3 + m.r3,
      r5: a.r5 + m.r5,
      mrr: a.mrr + m.mrr,
    }),
    { r1: 0, r3: 0, r5: 0, mrr: 0 },
  );
  return {
    "Recall@1": (sum.r1 / n).toFixed(3),
    "Recall@3": (sum.r3 / n).toFixed(3),
    "Recall@5": (sum.r5 / n).toFixed(3),
    MRR: (sum.mrr / n).toFixed(3),
  };
}

(async () => {
  const withLLM = process.argv.includes("--llm");
  const docs = loadDocs();
  const golden = loadGolden();
  console.log(`文档 ${docs.length} 条，评测查询 ${golden.length} 条（模式：${withLLM ? "增强管线" : "纯稀疏基线"}）`);

  const llm = withLLM
    ? createLLM({
        apiKey: process.env.CB_GATEWAY_KEY,
        baseURL: process.env.CB_GATEWAY_URL,
        model: "hy3",
        timeoutMs: 30000,
      })
    : null;

  const results = [];
  for (let i = 0; i < golden.length; i++) {
    const { query, doc: expected } = golden[i];
    const ranked = llm ? await enhancedSearch(llm, query, docs) : sparseSearch(query, docs);
    results.push(metrics(ranked, expected));
    if ((i + 1) % 40 === 0) console.log(`进度 ${i + 1}/${golden.length}`);
    if (llm) await new Promise((r) => setTimeout(r, 300)); // 温和限速
  }

  const m = fmt(results);
  console.table(m);

  // 评测报告落盘
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const variant = withLLM ? "enhanced_rewrite_rrf_rerank" : "sparse_baseline";
  const report = [
    `# 检索评测报告 · ${date}`,
    "",
    `- 方案：\`${variant}\``,
    `- 语料：知识库种子 ${docs.length} 条`,
    `- 评测查询：黄金集 ${golden.length} 条（hy3 模拟学生提问生成）`,
    "",
    "| 指标 | 数值 |",
    "|---|---|",
    ...Object.entries(m).map(([k, v]) => `| ${k} | ${v} |`),
    "",
  ].join("\n");
  const file = path.join(REPORTS_DIR, `${date}-${variant}.md`);
  fs.writeFileSync(file, report);
  console.log(`报告已写入 ${file}`);
})();
