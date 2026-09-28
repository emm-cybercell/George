/**
 * 文档向量入库：doc_vectors.json → kb_embeddings 集合
 * - 与 knowledge_base 按 question 对齐，_id 复用知识库文档 _id（usageCount 计数打通）
 * - 冗余 question/answer/tags/type/source，检索时免二次 join
 * 运行：TCB_ENV_ID=... TCB_SECRET_ID=... TCB_SECRET_KEY=... TCB_TOKEN=... node evals/pushVectors.js
 * （凭据用 CloudBase MCP auth get_temp_credentials 获取；云函数侧另有 EMBEDDING_SVC_URL 开关）
 */
const fs = require("fs");
const path = require("path");

const VEC_FILE = path.join(__dirname, "doc_vectors.json");

(async () => {
  for (const k of ["TCB_ENV_ID", "TCB_SECRET_ID", "TCB_SECRET_KEY"]) {
    if (!process.env[k]) {
      console.error(`缺少环境变量 ${k}`);
      process.exit(1);
    }
  }
  const tcb = require("@cloudbase/node-sdk");
  const app = tcb.init({
    env: process.env.TCB_ENV_ID,
    secretId: process.env.TCB_SECRET_ID,
    secretKey: process.env.TCB_SECRET_KEY,
    ...(process.env.TCB_TOKEN ? { sessionToken: process.env.TCB_TOKEN } : {}),
  });
  const db = app.database();

  const store = JSON.parse(fs.readFileSync(VEC_FILE, "utf8"));
  const vectors = store.vectors;
  console.log(`向量库：${Object.keys(vectors).length} 条 × ${store._meta.dim} 维`);

  const kbRes = await db.collection("knowledge_base").limit(500).get();
  const kbDocs = kbRes.data || [];
  console.log(`知识库文档：${kbDocs.length} 条`);

  let ok = 0;
  let miss = 0;
  for (const doc of kbDocs) {
    const vec = vectors[doc.question];
    if (!vec) {
      miss++;
      continue;
    }
    await db.collection("kb_embeddings").doc(doc._id).set({
      data: {
        id: doc._id,
        question: doc.question,
        answer: doc.answer,
        tags: doc.tags || [],
        type: doc.type,
        source: doc.source || "seed",
        abilityIds: doc.abilityIds || [],
        vec,
        model: store._meta.model,
        dim: store._meta.dim,
        updatedAt: Date.now(),
      },
    });
    ok++;
  }
  console.log(`入库完成：成功 ${ok}，无向量跳过 ${miss}（个人材料等）`);
  process.exit(0);
})().catch((err) => {
  console.error("推送失败:", err.message || err);
  process.exit(1);
});
