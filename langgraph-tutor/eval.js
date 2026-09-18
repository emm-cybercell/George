/**
 * LangGraph 轨检索评测：与自研轨跑同一黄金集（evals/golden_set.jsonl）
 * retrievalOnly 模式只走 classify→rewrite→retrieve（grade/respond 跳过，省 LLM）
 * 用法：CB_GATEWAY_KEY=... CB_GATEWAY_URL=... node eval.js
 * 输出：evals/reports/<date>-langgraph_rewrite_rrf.md
 */
const fs = require("fs");
const path = require("path");
const { createLLM } = require("../cloudfunctions/deepseekProxy/core/framework/llm");
const { runTutor } = require("./graph");

const SEEDS_DIR = path.join(__dirname, "../cloudfunctions/deepseekProxy/seeds");
const GOLDEN = path.join(__dirname, "../evals/golden_set.jsonl");
const REPORTS_DIR = path.join(__dirname, "../evals/reports");

function loadDocs() {
  const docs = [];
  for (const f of fs.readdirSync(SEEDS_DIR).filter((n) => n.endsWith(".jsonl"))) {
    for (const line of fs.readFileSync(path.join(SEEDS_DIR, f), "utf8").split("\n")) {
      if (line.trim()) docs.push(JSON.parse(line));
    }
  }
  return docs;
}

(async () => {
  const docs = loadDocs();
  const golden = fs
    .readFileSync(GOLDEN, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  console.log(`LangGraph 轨评测：文档 ${docs.length}，查询 ${golden.length}`);

  const llm = createLLM({
    apiKey: process.env.CB_GATEWAY_KEY,
    baseURL: process.env.CB_GATEWAY_URL,
    model: "hy3",
    timeoutMs: 30000,
  });

  const results = [];
  for (let i = 0; i < golden.length; i++) {
    const { query, doc: expected } = golden[i];
    const final = await runTutor(llm, docs, {
      query,
      threadId: "none", // 评测无多轮，跳过 checkpointer
      retrievalOnly: true,
    });
    const ranked = (final.docs || []).map((d) => d.question);
    const hitAt = (n) => (ranked.slice(0, n).includes(expected) ? 1 : 0);
    const idx = ranked.slice(0, 10).indexOf(expected);
    results.push({
      r1: hitAt(1),
      r3: hitAt(3),
      r5: hitAt(5),
      mrr: idx >= 0 ? 1 / (idx + 1) : 0,
    });
    if ((i + 1) % 40 === 0) console.log(`进度 ${i + 1}/${golden.length}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  const n = results.length || 1;
  const sum = results.reduce(
    (a, m) => ({ r1: a.r1 + m.r1, r3: a.r3 + m.r3, r5: a.r5 + m.r5, mrr: a.mrr + m.mrr }),
    { r1: 0, r3: 0, r5: 0, mrr: 0 },
  );
  const metrics = {
    "Recall@1": (sum.r1 / n).toFixed(3),
    "Recall@3": (sum.r3 / n).toFixed(3),
    "Recall@5": (sum.r5 / n).toFixed(3),
    MRR: (sum.mrr / n).toFixed(3),
  };
  console.table(metrics);

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const report = [
    `# 检索评测报告 · ${date}`,
    "",
    "- 方案：`langgraph_rewrite_rrf`（LangGraph StateGraph：classify→rewrite→retrieve，RRF 融合）",
    `- 语料：知识库种子 ${docs.length} 条`,
    `- 评测查询：黄金集 ${golden.length} 条（与自研轨同一集合）`,
    "",
    "| 指标 | 数值 |",
    "|---|---|",
    ...Object.entries(metrics).map(([k, v]) => `| ${k} | ${v} |`),
    "",
  ].join("\n");
  const file = path.join(REPORTS_DIR, `${date}-langgraph_rewrite_rrf.md`);
  fs.writeFileSync(file, report);
  console.log(`报告已写入 ${file}`);
})().catch((err) => {
  console.error("评测失败:", err.message || err);
  process.exit(1);
});
