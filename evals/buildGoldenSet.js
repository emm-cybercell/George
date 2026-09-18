/**
 * 黄金评测集构建：对知识库种子逐条生成改写查询（query → 期望文档）
 * - 模拟真实学生口语提问（与原文用词不同），作为检索评测的标准查询集
 * - 运行：node evals/buildGoldenSet.js   （需 CB_GATEWAY_KEY / CB_GATEWAY_URL 环境变量）
 * - 支持 resume：按文档 question 去重，中断后重跑自动续
 */
const fs = require("fs");
const path = require("path");
const { createLLM } = require("../cloudfunctions/deepseekProxy/core/framework/llm");

const SEEDS_DIR = path.join(__dirname, "../cloudfunctions/deepseekProxy/seeds");
const OUT = path.join(__dirname, "golden_set.jsonl");

function loadSeeds() {
  const docs = [];
  for (const f of fs.readdirSync(SEEDS_DIR).filter((n) => n.endsWith(".jsonl"))) {
    for (const line of fs.readFileSync(path.join(SEEDS_DIR, f), "utf8").split("\n")) {
      const t = line.trim();
      if (t) docs.push(JSON.parse(t));
    }
  }
  return docs;
}

async function genQuery(llm, doc) {
  const prompt = [
    {
      role: "system",
      content:
        '你负责构造检索评测集。根据知识条目，模拟一个 8-14 岁学生可能真实提出的、以该条目为最佳答案的问题。要求口语化、与原问题用词明显不同（同义改写）。只输出 JSON：{"query":"学生的问题"}',
    },
    {
      role: "user",
      content: `【条目】类型：${doc.type}；问题：${doc.question}；内容：${String(doc.answer).slice(0, 120)}；标签：${(doc.tags || []).join("/")}`,
    },
  ];
  // 429 退避重试（免费套餐 QPS 限制），最多 5 次
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await llm.chatJSON(prompt, { temperature: 0.8 });
      const q = String(r.query || "").trim().slice(0, 60);
      if (q) return q;
    } catch (err) {
      const is429 = /\b429\b|rate.?limit/i.test(String(err.message || err));
      if (!is429 && attempt === 4) return null;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

(async () => {
  const docs = loadSeeds();
  console.log(`种子文档：${docs.length} 条`);

  // resume：跳过已生成的
  const done = new Set();
  if (fs.existsSync(OUT)) {
    for (const line of fs.readFileSync(OUT, "utf8").split("\n")) {
      if (line.trim()) done.add(JSON.parse(line).doc);
    }
  }
  const pending = docs.filter((d) => !done.has(d.question));
  console.log(`已完成 ${done.size}，待生成 ${pending.length}`);

  if (!process.env.CB_GATEWAY_KEY) {
    console.error("缺少 CB_GATEWAY_KEY 环境变量");
    process.exit(1);
  }
  const llm = createLLM({
    apiKey: process.env.CB_GATEWAY_KEY,
    baseURL: process.env.CB_GATEWAY_URL,
    model: "hy3",
    timeoutMs: 30000,
  });

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < pending.length; i++) {
    const doc = pending[i];
    const query = await genQuery(llm, doc);
    if (query) {
      fs.appendFileSync(OUT, JSON.stringify({ query, doc: doc.question, type: doc.type }) + "\n");
      ok++;
    } else {
      fail++;
      console.warn(`✗ 生成失败：${doc.question}`);
    }
    if ((i + 1) % 20 === 0) console.log(`进度 ${i + 1}/${pending.length}（成功 ${ok} 失败 ${fail}）`);
    await new Promise((r) => setTimeout(r, 300)); // 温和限速
  }
  console.log(`构建完成：成功 ${ok}，失败 ${fail}，总计 ${done.size + ok}`);
  process.exit(fail > pending.length * 0.2 ? 1 : 0);
})();
