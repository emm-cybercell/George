/**
 * RAG 检索管线 v2 单测：稠密主路径 / 稀疏降级链 / 分块 / 历史组件（RRF）
 * - 依赖注入 mock llm / mock db / mock embedFn，不触网
 * 运行：node --test tests/ragPipeline.spec.js
 */
const { test } = require("node:test");
const assert = require("node:assert");
const {
  retrieveEnhanced,
  rrfFuse,
  denseRank,
  RRF_K,
} = require("../cloudfunctions/deepseekProxy/core/ragPipeline");
const { chunkMaterial } = require("../cloudfunctions/deepseekProxy/core/chunking");
const { scriptedLLM } = require("./helpers");

/** mock 云数据库：kb_embeddings 向量库 + knowledge_base 稀检索引 + usageCount 埋点 */
function mockDB({ vectorDocs = [], sparseDocs = [] } = {}) {
  const bumps = [];
  const command = { inc: (n) => ({ __inc: n }) };
  const collection = (name) => {
    if (name === "kb_embeddings") {
      return {
        limit: () => ({ get: async () => ({ data: [...vectorDocs] }) }),
        get: async () => ({ data: [...vectorDocs] }),
      };
    }
    if (name === "knowledge_base") {
      const kb = {
        field: () => ({
          limit: () => ({ get: async () => ({ data: [...sparseDocs] }) }),
        }),
        where: (cond) => {
          const data = cond && cond.source === "user" ? [] : sparseDocs;
          return {
            field: () => ({
              limit: () => ({ get: async () => ({ data: [...data] }) }),
              get: async () => ({ data: [...data] }),
            }),
            limit: () => ({ get: async () => ({ data: [...data] }) }),
            get: async () => ({ data: [...data] }),
            count: async () => ({ total: data.length }),
          };
        },
        limit: () => ({ get: async () => ({ data: [...sparseDocs] }) }),
        get: async () => ({ data: [...sparseDocs] }),
        doc: (id) => ({
          update: async ({ data }) => {
            bumps.push({ id, data });
            return {};
          },
        }),
      };
      return kb;
    }
    if (name === "system_configs") {
      return { doc: () => ({ get: async () => ({ data: null }) }) };
    }
    throw new Error("unexpected collection: " + name);
  };
  return { bumps, command, collection };
}

/** 与 doc_vectors 同构的 3 维测试向量：d1 与查询同向 */
const SPARSE_DOCS = [
  { _id: "d1", type: "faq", question: "为什么先乘除后加减？", answer: "乘除是打包的加法。", tags: ["数学"], abilityIds: [], usageCount: 0, source: "seed" },
  { _id: "d2", type: "quiz", question: "什么东西越洗越脏？", answer: "水。", tags: [], abilityIds: [], usageCount: 0, source: "seed" },
  { _id: "d3", type: "faq", question: "分数怎么比较大小？", answer: "通分后比较。", tags: ["数学"], abilityIds: [], usageCount: 0, source: "seed" },
];

function mkVecDoc(id, vec) {
  const d = SPARSE_DOCS.find((x) => x._id === id);
  return { id, question: d.question, answer: d.answer, tags: d.tags, type: d.type, source: d.source, vec };
}

test("chunkMaterial：短文本单块；长文本多块且带重叠、按语义边界切", () => {
  assert.deepEqual(chunkMaterial(""), []);
  assert.deepEqual(chunkMaterial("短文本"), ["短文本"]);
  const paras = Array.from({ length: 6 }, (_, i) => `第${i + 1}段。${"内容".repeat(80)}`);
  const chunks = chunkMaterial(paras.join("\n"), 350, 50);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) assert.ok(c.length <= 350, `块超长：${c.length}`);
  assert.ok(chunks[0].startsWith("第1段"));
});

test("rrfFuse：多路召回按排名倒数求和融合，重复候选只计一次", () => {
  const mk = (q, score) => ({ type: "faq", question: q, answer: "a", tags: [], score });
  const fused = rrfFuse([[mk("甲", 0.9), mk("乙", 0.5)], [mk("乙", 0.8), mk("丙", 0.4)]], 5);
  assert.equal(fused[0].question, "乙");
  assert.equal(fused.length, 3);
  assert.ok(fused.every((f) => f.rrfScore > 0));
  assert.ok(typeof RRF_K === "number" && RRF_K === 60);
});

test("denseRank：纯函数按余弦降序，剥离 vec 字段", () => {
  const queryVec = [1, 0, 0];
  const docVecs = [
    mkVecDoc("d2", [0, 1, 0]),
    mkVecDoc("d1", [1, 0, 0]),
    mkVecDoc("d3", [0.7, 0.7, 0]),
  ];
  const ranked = denseRank(queryVec, docVecs, 2);
  assert.equal(ranked[0].question, "为什么先乘除后加减？");
  assert.equal(ranked.length, 2);
  assert.ok(!("vec" in ranked[0]), "结果不应携带 vec（上下文体积）");
  assert.ok(ranked[0].score > ranked[1].score);
});

test("loadVectorizedDocs 兼容 node-sdk {_id,data} 包裹格式", async () => {
  const { loadVectorizedDocs } = require("../cloudfunctions/deepseekProxy/core/ragPipeline");
  const wrappedDb = {
    collection: () => ({
      limit: () => ({
        get: async () => ({
          data: [
            { _id: "d1", data: mkVecDoc("d1", [1, 0, 0]) },  // node-sdk 包裹
            mkVecDoc("d2", [0, 1, 0]),                        // wx-server-sdk 扁平
          ],
        }),
      }),
    }),
  };
  const docs = await loadVectorizedDocs(wrappedDb);
  assert.equal(docs.length, 2);
  assert.equal(docs[0].question, "为什么先乘除后加减？");
  assert.ok(Array.isArray(docs[0].vec));
  assert.equal(docs[1].question, "什么东西越洗越脏？");
});

test("主路径：稠密召回→LLM重排→只对最终结果计数（1 次 LLM）", async () => {
  const llm = scriptedLLM([
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
  const db = mockDB({
    vectorDocs: [mkVecDoc("d2", [0, 1, 0]), mkVecDoc("d1", [1, 0, 0]), mkVecDoc("d3", [0.7, 0.7, 0])],
    sparseDocs: SPARSE_DOCS,
  });
  const embedFn = async () => [1, 0, 0];

  const hits = await retrieveEnhanced(db, llm, "乘除哪个先算", { topK: 3, embedFn });

  assert.equal(llm.calls.length, 1, "仅重排一次调用，无改写");
  assert.equal(hits[0].question, "为什么先乘除后加减？");
  assert.equal(db.bumps.length, hits.length);
  assert.ok(db.bumps.every((b) => b.data.usageCount.__inc === 1));
});

test("降级：embedding 服务不可用 → 稀疏召回 + LLM 重排（1 次 LLM）", async () => {
  const llm = scriptedLLM([
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
  const db = mockDB({ sparseDocs: SPARSE_DOCS }); // 无向量库

  const hits = await retrieveEnhanced(db, llm, "学习和数学有什么好方法", { topK: 2 });

  assert.equal(llm.calls.length, 1);
  assert.ok(hits.length >= 1 && hits.length <= 2);
  assert.equal(db.bumps.length, hits.length);
});

test("降级：重排失败回退稀疏顺序，不阻断链路", async () => {
  const llm = scriptedLLM([{ role: "assistant", content: "not json" }]);
  const db = mockDB({ sparseDocs: SPARSE_DOCS });

  const hits = await retrieveEnhanced(db, llm, "分数比较大小", { topK: 2 });

  assert.ok(hits.length >= 1 && hits.length <= 2);
  assert.equal(db.bumps.length, hits.length);
});

test("双降级：无 LLM 客户端 → 纯稀疏 topK（旧链路兼容）", async () => {
  const db = mockDB({ sparseDocs: SPARSE_DOCS });
  const hits = await retrieveEnhanced(db, null, "分数比较大小", { topK: 3 });
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].question, "分数怎么比较大小？");
  assert.equal(db.bumps.length, hits.length);
});
