/**
 * RAG 检索核心单元测试（纯函数零依赖）
 * 运行：node --test tests/retrieval.spec.js
 */
const test = require("node:test");
const assert = require("assert");
const {
  tokenize,
  termFreq,
  normalize,
  cosine,
  buildCorpus,
  vectorize,
  search,
} = require("../cloudfunctions/deepseekProxy/core/retrievalCore");

test("tokenize：中文 bigram + 英数词元", () => {
  assert.deepStrictEqual(tokenize("乘法口诀").slice(0, 3), ["乘法", "法口", "口诀"]);
  assert.ok(tokenize("learn AI 2026").includes("learn"));
  assert.ok(tokenize("learn AI 2026").includes("ai"));
  assert.ok(tokenize("learn AI 2026").includes("2026"));
  // 单字中文：无 bigram，返回空
  assert.deepStrictEqual(tokenize("好"), []);
});

test("termFreq：词频统计", () => {
  const tf = termFreq(["a", "b", "a"]);
  assert.strictEqual(tf["a"], 2);
  assert.strictEqual(tf["b"], 1);
});

test("normalize + cosine：正交为零、相同为一", () => {
  const a = normalize({ x: 1 });
  const b = normalize({ x: 1 });
  const c = normalize({ y: 1 });
  assert.ok(Math.abs(cosine(a, b) - 1) < 1e-9);
  assert.strictEqual(cosine(a, c), 0);
});

test("buildCorpus + vectorize：查询向量非零且归一化", () => {
  const corpus = buildCorpus([
    { question: "分数加法", answer: "通分", tags: ["数学"] },
    { question: "彩虹原理", answer: "折射", tags: ["科学"] },
  ]);
  const v = vectorize("分数", corpus);
  let sum = 0;
  for (const k in v) sum += v[k] * v[k];
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("search：相关查询命中正确文档", () => {
  const docs = [
    { question: "分数加法怎么算", answer: "通分后分子相加", tags: ["数学", "分数"], type: "faq" },
    { question: "彩虹为什么是弯的", answer: "折射圆弧", tags: ["科学", "光学"], type: "faq" },
    { question: "什么门关不上", answer: "球门", tags: ["脑筋急转弯"], type: "quiz" },
  ];
  const hits = search("分数怎么加", docs);
  assert.ok(hits.length > 0);
  assert.strictEqual(hits[0].doc.question, "分数加法怎么算");
  assert.ok(hits[0].score >= 0.15);
});

test("search：阈值过滤无关查询", () => {
  const docs = [
    { question: "分数加法", answer: "通分", tags: ["数学"] },
    { question: "彩虹原理", answer: "折射", tags: ["科学"] },
  ];
  const hits = search("量子纠缠超导", docs);
  assert.strictEqual(hits.length, 0);
});

test("search：tag 命中获得加权提升", () => {
  const docs = [
    { question: "两数之和问题", answer: "甲乙相加的内容", tags: ["谜题"], type: "quiz" },
  ];
  const withTag = search("谜题", docs, { tagBoost: 2, threshold: 0 });
  const noTag = search("无关词", docs, { tagBoost: 2, threshold: 0 });
  assert.ok(withTag[0].score > noTag[0].score);
});

test("search：topK 截断与类型偏好", () => {
  const docs = [
    { question: "题一", answer: "挑战内容", tags: [], type: "quiz" },
    { question: "题二", answer: "挑战内容", tags: [], type: "faq" },
    { question: "题三", answer: "挑战内容", tags: [], type: "mission" },
  ];
  const hits = search("挑战", docs, { topK: 2, preferTypes: ["quiz"], threshold: 0 });
  assert.strictEqual(hits.length, 2);
  assert.strictEqual(hits[0].doc.type, "quiz");
});

test("search：培养方向加权（abilityIds 交集提升排名）", () => {
  const docs = [
    { question: "色彩构图练习", answer: "观察色彩与构图", tags: ["美术"], abilityIds: ["art"], type: "quiz" },
    { question: "数列找规律", answer: "观察数列规律", tags: ["数学"], abilityIds: ["logic"], type: "quiz" },
  ];
  // query 同时模糊命中两题，但用户方向是 art → 色彩题应排前
  const hits = search("观察练习", docs, {
    preferAbilities: ["art"],
    threshold: 0,
  });
  assert.strictEqual(hits[0].doc.abilityIds[0], "art");
  // 对照：无偏好时顺序可能不同，但分数必须严格更高
  const plain = search("观察练习", docs, { threshold: 0 });
  assert.ok(hits[0].score > plain.find((h) => h.doc.abilityIds[0] === "art").score);
});

test("search：培养方向无交集时不加权", () => {
  const docs = [
    { question: "数列找规律", answer: "观察数列规律", tags: ["数学"], abilityIds: ["logic"], type: "quiz" },
  ];
  const withAbility = search("观察数列", docs, {
    preferAbilities: ["art"],
    threshold: 0,
  })[0].score;
  const plain = search("观察数列", docs, { threshold: 0 })[0].score;
  assert.strictEqual(withAbility, plain);
});

test("search：空输入安全", () => {
  assert.deepStrictEqual(search("", [{ question: "a", answer: "b" }]), []);
  assert.deepStrictEqual(search("x", []), []);
});
