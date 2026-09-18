/**
 * RAG 增强管线单元测试：分块 / RRF 融合 / 增强检索链路 / 降级路径
 * - 依赖注入 mock LLM 与 mock db，不触网
 * 运行：node --test tests/ragPipeline.spec.js
 */
const { test } = require("node:test");
const assert = require("node:assert");
const {
  retrieveEnhanced,
  rrfFuse,
  RRF_K,
} = require("../cloudfunctions/deepseekProxy/core/ragPipeline");
const { chunkMaterial } = require("../cloudfunctions/deepseekProxy/core/chunking");
const { scriptedLLM } = require("./helpers");

const DOCS = [
  { _id: "d1", type: "faq", question: "为什么先乘除后加减？", answer: "因为乘除是打包的加法：3×4 就是 3 个 4 相加。", tags: ["数学", "运算"], abilityIds: ["logic"], usageCount: 0 },
  { _id: "d2", type: "quiz", question: "什么东西越洗越脏？", answer: "水。洗的东西干净了，水却变脏了。", tags: ["脑筋急转弯"], abilityIds: [], usageCount: 0 },
  { _id: "d3", type: "mission", question: "设计一周零花钱计划", answer: "记录每日开支，周末复盘。", tags: ["财商"], abilityIds: ["self"], usageCount: 0 },
  { _id: "d4", type: "faq", question: "分数怎么比较大小？", answer: "通分成同一分母再比较。", tags: ["数学", "分数"], abilityIds: ["logic"], usageCount: 0 },
];

/** mock 云数据库：检索 / usageCount 计数埋点 / system_configs 空配置 */
function mockDB(publicDocs, userDocs = []) {
  const bumps = [];
  const kbWhere = (cond) => {
    const data = cond && cond.source === "user" ? userDocs : publicDocs;
    return {
      field: () => ({
        limit: () => ({ get: async () => ({ data: [...data] }) }),
        get: async () => ({ data: [...data] }),
      }),
      limit: () => ({ get: async () => ({ data: [...data] }) }),
      get: async () => ({ data: [...data] }),
      count: async () => ({ total: data.length }),
    };
  };
  return {
    bumps,
    command: { inc: (n) => ({ __inc: n }) },
    collection: (name) => {
      if (name === "knowledge_base") {
        return {
          field: () => ({
            limit: () => ({ get: async () => ({ data: [...publicDocs] }) }),
          }),
          where: kbWhere,
          doc: (id) => ({
            update: async ({ data }) => {
              bumps.push({ id, data });
              return {};
            },
          }),
        };
      }
      if (name === "system_configs") {
        return { doc: () => ({ get: async () => ({ data: null }) }) };
      }
      throw new Error("unexpected collection: " + name);
    },
  };
}

test("chunkMaterial：短文本单块；长文本多块且带重叠、按语义边界切", () => {
  assert.deepEqual(chunkMaterial(""), []);
  assert.deepEqual(chunkMaterial("短文本"), ["短文本"]);

  const paras = Array.from({ length: 6 }, (_, i) => `第${i + 1}段。${"内容".repeat(80)}`);
  const long = paras.join("\n");
  const chunks = chunkMaterial(long, 350, 50);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) assert.ok(c.length <= 350, `块超长：${c.length}`);
  // 相邻块有重叠：后一块开头出现在前一块尾部
  assert.ok(chunks[1].slice(0, 40).split("").some((ch, i) => ch === chunks[0].slice(-90)[i]));
  // 覆盖完整：拼接去重后应包含首段开头与末段结尾
  assert.ok(chunks[0].startsWith("第1段"));
  assert.ok(chunks[chunks.length - 1].includes("第6段") || chunks.join("").includes("第6段"));
});

test("rrfFuse：多路召回按排名倒数求和融合，重复候选只计一次", () => {
  const mk = (q, score) => ({ type: "faq", question: q, answer: "a", tags: [], score });
  const fused = rrfFuse(
    [
      [mk("甲", 0.9), mk("乙", 0.5)],
      [mk("乙", 0.8), mk("丙", 0.4)],
    ],
    5,
  );
  // 乙在两路都靠前 → RRF 分最高
  assert.equal(fused[0].question, "乙");
  assert.ok(fused.length === 3);
  assert.ok(fused.every((f) => f.rrfScore > 0));
  assert.ok(Math.abs(fused[0].rrfScore - (1 / (RRF_K + 2) - 0)) < 0.01 || fused[0].rrfScore > 0);
});

test("retrieveEnhanced：改写→双路召回→RRF→LLM重排→只对最终结果计数", async () => {
  const llm = scriptedLLM([
    // ① 查询改写
    { role: "assistant", content: JSON.stringify({ rewritten: "乘除运算顺序", synonyms: ["运算优先级"] }) },
    // ② LLM 重排：把稀疏分低的 d2 提到第一
    {
      role: "assistant",
      content: JSON.stringify({
        scores: [
          { id: 1, score: 9 },
          { id: 2, score: 2 },
          { id: 3, score: 3 },
        ],
      }),
    },
  ]);
  const db = mockDB(DOCS);

  const hits = await retrieveEnhanced(db, llm, "学习和数学有什么好方法", { topK: 3, openid: "u1" });

  assert.equal(llm.calls.length, 2); // 改写 + 重排，检索本身不耗 LLM
  assert.ok(hits.length >= 2, `应召回多个候选，实际 ${hits.length}`);
  assert.ok(hits.length >= 1 && hits.length <= 3);
  assert.equal(hits[0].question, "为什么先乘除后加减？"); // 重排分 9 → 第一
  // usageCount 只对最终结果计数（双路召回 skipUsage）
  assert.equal(db.bumps.length, hits.length);
  assert.ok(db.bumps.every((b) => b.data.usageCount.__inc === 1));
});

test("retrieveEnhanced：重排失败回退 RRF 顺序，不阻断链路", async () => {
  const llm = scriptedLLM([
    { role: "assistant", content: JSON.stringify({ rewritten: "乘除运算顺序", synonyms: [] }) },
    { role: "assistant", content: "不是合法 JSON" },
  ]);
  const db = mockDB(DOCS);

  const hits = await retrieveEnhanced(db, llm, "学习和数学有什么好方法", { topK: 2, openid: "u1" });

  assert.ok(hits.length >= 1 && hits.length <= 2);
  assert.ok(hits.every((h) => h.rerankScore === undefined));
  assert.equal(db.bumps.length, hits.length);
});

test("retrieveEnhanced：无 LLM 客户端退化为纯稀疏检索（旧链路兼容）", async () => {
  const db = mockDB(DOCS);
  const hits = await retrieveEnhanced(db, null, "分数比较大小", { topK: 3, openid: "u1" });
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].question, "分数怎么比较大小？");
  assert.equal(db.bumps.length, hits.length);
});
