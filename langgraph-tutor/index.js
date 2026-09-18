/**
 * CLI 入口：node index.js "学生的问题" [--show-docs]
 * 模型同源自研轨（CloudBase 网关 hy3，framework/llm.js 客户端）
 */
const fs = require("fs");
const path = require("path");
const { createLLM } = require("../cloudfunctions/deepseekProxy/core/framework/llm");
const { runTutor } = require("./graph");

function loadDocs() {
  const seedsDir = path.join(__dirname, "../cloudfunctions/deepseekProxy/seeds");
  const docs = [];
  for (const f of fs.readdirSync(seedsDir).filter((n) => n.endsWith(".jsonl"))) {
    for (const line of fs.readFileSync(path.join(seedsDir, f), "utf8").split("\n")) {
      if (line.trim()) docs.push(JSON.parse(line));
    }
  }
  return docs;
}

(async () => {
  const query = process.argv[2];
  if (!query) {
    console.log("用法：node index.js \"学生的问题\" [--show-docs]");
    process.exit(1);
  }
  if (!process.env.CB_GATEWAY_KEY || !process.env.CB_GATEWAY_URL) {
    console.error("缺少 CB_GATEWAY_KEY / CB_GATEWAY_URL 环境变量");
    process.exit(1);
  }
  const llm = createLLM({
    apiKey: process.env.CB_GATEWAY_KEY,
    baseURL: process.env.CB_GATEWAY_URL,
    model: "hy3",
    timeoutMs: 30000,
  });

  const startedAt = Date.now();
  const final = await runTutor(llm, loadDocs(), { query, threadId: "cli-demo" });

  console.log(`[意图] ${final.intent}`);
  console.log(`[改写] ${final.rewritten || "（未改写）"}`);
  if (process.argv.includes("--show-docs")) {
    console.log(
      `[文档] ${(final.gradedDocs || []).map((d) => d.question).join(" | ") || "无"}`,
    );
  }
  console.log(`\n${final.answer}`);
  console.error(`\n--- ${Date.now() - startedAt}ms ---`);
})().catch((err) => {
  console.error("运行失败:", err.message || err);
  process.exit(1);
});
