/**
 * LangGraph 对照轨单元测试（mock llm，不触网）
 * - 闲聊路径：classify=casual 直接 respond，不走检索
 * - 知识路径：rewrite→retrieve→grade→respond 全链路状态流转
 * - 评测模式：retrievalOnly 跳过 grade/respond 的 LLM 调用
 * 运行：node --test tests/langgraph.spec.js（需先 cd langgraph-tutor && npm install）
 */
const { test } = require("node:test");
const assert = require("node:assert");
const { runTutor } = require("../langgraph-tutor/graph");
const { scriptedLLM } = require("./helpers");

const DOCS = [
  { type: "faq", question: "为什么先乘除后加减？", answer: "乘除是打包的加法。", tags: ["数学"] },
  { type: "quiz", question: "什么东西越洗越脏？", answer: "水。", tags: ["脑筋急转弯"] },
  { type: "faq", question: "分数怎么比较大小？", answer: "通分后比较。", tags: ["数学"] },
];

test("知识路径：rewrite→retrieve→grade→respond 状态齐全", async () => {
  const llm = scriptedLLM([
    // classify
    { role: "assistant", content: JSON.stringify({ intent: "knowledge" }) },
    // rewrite
    { role: "assistant", content: JSON.stringify({ rewritten: "乘除运算顺序", synonyms: ["运算优先级"] }) },
    // grade
    {
      role: "assistant",
      content: JSON.stringify({ verdicts: [{ id: 1, relevant: true }, { id: 2, relevant: false }] }),
    },
    // respond
    { role: "assistant", content: "先想一想乘法是什么意思……" },
  ]);

  const final = await runTutor(llm, DOCS, {
    query: "乘除哪个先算",
    threadId: "none",
  });

  assert.equal(final.intent, "knowledge");
  assert.ok(final.rewritten.includes("乘除运算顺序"));
  assert.ok(final.docs.length >= 1);
  assert.ok(final.gradedDocs.length >= 1);
  assert.ok(final.answer.includes("乘法"));
  // respond 轮携带知识库参考
  const respondCall = llm.calls[llm.calls.length - 1];
  const ctx = respondCall.messages.find((m) => (m.content || "").includes("知识库参考"));
  assert.ok(ctx, "respond 应注入知识库参考");
});

test("闲聊路径：classify=casual 跳过检索直接应答", async () => {
  const llm = scriptedLLM([
    { role: "assistant", content: JSON.stringify({ intent: "casual" }) },
    { role: "assistant", content: "我在这儿陪你呀" },
  ]);

  const final = await runTutor(llm, DOCS, { query: "我今天有点累", threadId: "none" });

  assert.equal(final.intent, "casual");
  assert.equal(final.docs.length, 0);
  assert.ok(final.answer.includes("陪你"));
  // 只应有 2 次 LLM 调用（classify + respond），无 rewrite/grade
  assert.equal(llm.calls.length, 2);
});

test("评测模式 retrievalOnly：只消耗 classify 占位与 rewrite 一次 LLM", async () => {
  const llm = scriptedLLM([
    { role: "assistant", content: JSON.stringify({ rewritten: "乘除运算顺序", synonyms: [] }) },
  ]);

  const final = await runTutor(llm, DOCS, {
    query: "乘除哪个先算",
    threadId: "none",
    retrievalOnly: true,
  });

  assert.equal(llm.calls.length, 1); // 仅 rewrite
  assert.ok(final.docs.length >= 1);
  assert.equal(final.answer, undefined);
});

test("rewrite 失败退化为原查询，链路不中断", async () => {
  const llm = scriptedLLM([
    { role: "assistant", content: JSON.stringify({ intent: "knowledge" }) },
    { role: "assistant", content: "not json" },
    { role: "assistant", content: JSON.stringify({ verdicts: [] }) },
    { role: "assistant", content: "最终回答" },
  ]);

  const final = await runTutor(llm, DOCS, { query: "分数怎么比较大小", threadId: "none" });

  assert.equal(final.rewritten, "分数怎么比较大小");
  assert.ok(final.docs.length >= 1);
  assert.equal(final.answer, "最终回答");
});
