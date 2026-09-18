/**
 * 推理范式单元测试：react / reflection / plan_execute
 * - 依赖注入 mock LLM 与 registry，不触网
 * 运行：node --test tests/patterns.spec.js
 */
const { test } = require("node:test");
const assert = require("node:assert");
const { runPattern, PATTERNS } = require("../cloudfunctions/deepseekProxy/patterns/index");
const { scriptedLLM, stubRegistry, BASE } = require("./helpers");

const MSGS = [{ role: "user", content: "帮我做数学作业第3题" }];

test("react（默认）：未知范式回退，行为同 ReAct", async () => {
  const llm = scriptedLLM([{ role: "assistant", content: "直接回答" }]);
  const { reg } = stubRegistry({});
  for (const name of [undefined, "react", "unknown_pattern"]) {
    const res = await runPattern(name, { ...BASE, messages: MSGS, llm, registry: reg });
    assert.equal(res.reply, "直接回答");
    assert.equal(res.trace.length, 1);
  }
  assert.deepEqual(Object.keys(PATTERNS).sort(), ["plan_execute", "react", "reflection"]);
});

test("reflection：自检 revise 时以修订稿定稿，trace 记录自检步", async () => {
  const llm = scriptedLLM([
    { role: "assistant", content: "答案是 42。写上去就行。" },
    // chatJSON 走同一条 chat 通道，第二次调用返回质检 JSON
    {
      role: "assistant",
      content: JSON.stringify({
        verdict: "revise",
        issues: ["直接给出作业完整答案（红）"],
        revised: "这道题先想一想：题目要求的是什么量？试着列一个式子，我陪你检查。",
      }),
    },
  ]);
  const { reg } = stubRegistry({});

  const res = await runPattern("reflection", { ...BASE, messages: MSGS, llm, registry: reg });

  assert.ok(res.reply.includes("列一个式子"));
  assert.ok(!res.reply.includes("42"));
  const reflectStep = res.trace.find((t) => t.step === "reflection");
  assert.equal(reflectStep.action, "revise");
  assert.ok(reflectStep.thought.includes("红"));
  // 最终回答轮之后没有再调用 LLM（自检即定稿）
  assert.equal(llm.calls.length, 2);
});

test("reflection：自检 pass 时保留初答", async () => {
  const llm = scriptedLLM([
    { role: "assistant", content: "先说说你的思路，我来帮你补全。" },
    { role: "assistant", content: JSON.stringify({ verdict: "pass", issues: [] }) },
  ]);
  const { reg } = stubRegistry({});

  const res = await runPattern("reflection", { ...BASE, messages: MSGS, llm, registry: reg });

  assert.ok(res.reply.includes("思路"));
  assert.equal(res.trace.find((t) => t.step === "reflection").action, "pass");
});

test("reflection：自检异常时退化为初答（可用性优先）", async () => {
  const llm = scriptedLLM([{ role: "assistant", content: "初答" }]);
  llm.chat = llm.chat; // keep
  llm.chatJSON = async () => {
    throw new Error("judge down");
  };
  const { reg } = stubRegistry({});

  const res = await runPattern("reflection", { ...BASE, messages: MSGS, llm, registry: reg });

  assert.equal(res.reply, "初答");
  assert.equal(res.trace.find((t) => t.step === "reflection").action, "pass");
});

test("plan_execute：先规划后执行，计划以 system 注入且 trace 首步为 plan", async () => {
  const llm = scriptedLLM([
    { role: "assistant", content: JSON.stringify({ steps: ["确认题意", "列式思路", "引导自查"] }) },
    { role: "assistant", content: "我们按计划来：先确认题意……" },
  ]);
  const { reg } = stubRegistry({});

  const res = await runPattern("plan_execute", { ...BASE, messages: MSGS, llm, registry: reg });

  assert.ok(res.reply.includes("按计划"));
  const execCall = llm.calls[1];
  const planMsg = execCall.messages.find(
    (m) => m.role === "system" && m.content.includes("执行计划"),
  );
  assert.ok(planMsg.content.includes("3. 引导自查"));
  assert.equal(res.trace[0].step, "plan");
  assert.ok(res.trace[0].thought.includes("列式思路"));
});

test("plan_execute：规划失败退化为纯 ReAct，不阻断", async () => {
  const llm = scriptedLLM([{ role: "assistant", content: "直接回答" }]);
  llm.chatJSON = async () => {
    throw new Error("plan down");
  };
  const { reg } = stubRegistry({});

  const res = await runPattern("plan_execute", { ...BASE, messages: MSGS, llm, registry: reg });

  assert.equal(res.reply, "直接回答");
  assert.equal(res.trace[0].thought.includes("规划失败"), true);
  // 只有一次 LLM 调用（规划失败后直接走了循环的 chat，无第二次规划）
  assert.equal(llm.calls.length, 1);
});
