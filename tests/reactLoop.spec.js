/**
 * ReAct Loop（自研框架核心）单元测试
 * - 通过依赖注入 mock LLM 与 ToolRegistry，不触网
 * - 覆盖：直接回答 / 工具循环与观察回填 / 工具异常降级 / 步数耗尽强制总结 / 情景记忆注入
 * 运行：node --test tests/reactLoop.spec.js
 */
const { test } = require("node:test");
const assert = require("node:assert");
const { runFrameworkLoop } = require("../cloudfunctions/deepseekProxy/core/framework/loop");
const { ToolRegistry } = require("../cloudfunctions/deepseekProxy/core/framework/registry");

/** 脚本化 LLM stub：按调用次序返回预设消息，记录每次入参 */
function scriptedLLM(steps) {
  const calls = [];
  return {
    calls,
    chat: async (messages, opts) => {
      calls.push({ messages, opts });
      const i = Math.min(calls.length - 1, steps.length - 1);
      return steps[i];
    },
  };
}

function stubRegistry(handlers) {
  const reg = new ToolRegistry();
  const invoked = [];
  for (const [name, handler] of Object.entries(handlers)) {
    reg.register(
      { name, description: `stub ${name}`, parameters: { type: "object" } },
      async (ctx) => {
        invoked.push({ name, args: ctx.args });
        return handler(ctx);
      },
      "test",
    );
  }
  return { reg, invoked };
}

const BASE = {
  config: { model: "hy3", temperature: 0.7 },
  db: null,
  openid: "test-openid",
};

test("无工具调用：直接回答，trace 单步 respond", async () => {
  const llm = scriptedLLM([{ role: "assistant", content: "你好呀" }]);
  const { reg } = stubRegistry({});

  const res = await runFrameworkLoop({
    ...BASE,
    messages: [{ role: "user", content: "你好" }],
    llm,
    registry: reg,
  });

  assert.equal(res.reply, "你好呀");
  assert.equal(res.executedTools.length, 0);
  assert.equal(res.trace.length, 1);
  assert.equal(res.trace[0].action, "respond");
});

test("工具循环：观察回填后给出最终回答，trace 与 executedTools 完整", async () => {
  const llm = scriptedLLM([
    {
      role: "assistant",
      content: "我需要查知识库",
      tool_calls: [
        {
          id: "c1",
          function: {
            name: "search_knowledge",
            arguments: JSON.stringify({ query: "太阳系" }),
          },
        },
      ],
    },
    { role: "assistant", content: "太阳系有八大行星" },
  ]);
  const { reg, invoked } = stubRegistry({
    search_knowledge: () => ({ success: true, docs: [{ question: "太阳系几大行星" }] }),
  });

  const res = await runFrameworkLoop({
    ...BASE,
    messages: [{ role: "user", content: "太阳系有几大行星？" }],
    llm,
    registry: reg,
  });

  assert.equal(res.reply, "太阳系有八大行星");
  assert.deepEqual(invoked, [{ name: "search_knowledge", args: { query: "太阳系" } }]);
  assert.equal(res.executedTools[0].name, "search_knowledge");

  // 第二轮 LLM 入参应包含 assistant(tool_calls) + tool 观察回填
  const second = llm.calls[1];
  assert.equal(second.opts.tools.length, 1); // 最终回答轮仍带工具定义
  const toolMsg = second.messages.find((m) => m.role === "tool");
  assert.equal(toolMsg.tool_call_id, "c1");
  assert.ok(toolMsg.content.includes("太阳系几大行星"));

  // trace：step1 act + step2 respond
  assert.equal(res.trace.length, 2);
  assert.equal(res.trace[0].action, "search_knowledge");
  assert.equal(res.trace[0].step, 1);
  assert.equal(res.trace[1].action, "respond");
  assert.ok(res.trace[0].durationMs >= 0);
});

test("工具异常：registry 转为 error 观察回填，循环不中断", async () => {
  const llm = scriptedLLM([
    {
      role: "assistant",
      content: "",
      tool_calls: [
        { id: "c1", function: { name: "boom", arguments: "{}" } },
      ],
    },
    { role: "assistant", content: "出错了，我换个说法" },
  ]);
  const reg = new ToolRegistry();
  reg.register(
    { name: "boom", description: "boom", parameters: { type: "object" } },
    async () => {
      throw new Error("boom");
    },
  );

  const res = await runFrameworkLoop({
    ...BASE,
    messages: [{ role: "user", content: "测试" }],
    llm,
    registry: reg,
  });

  assert.equal(res.reply, "出错了，我换个说法");
  const toolMsg = llm.calls[1].messages.find((m) => m.role === "tool");
  assert.ok(toolMsg.content.includes("boom"));
  assert.equal(res.executedTools[0].result.success, false);
});

test("步数预算耗尽：禁用工具强制总结，防止死循环", async () => {
  const toolCallMsg = {
    role: "assistant",
    content: "",
    tool_calls: [{ id: "c1", function: { name: "loop_tool", arguments: "{}" } }],
  };
  const llm = scriptedLLM([toolCallMsg, toolCallMsg, { role: "assistant", content: "最终总结" }]);
  const { reg } = stubRegistry({ loop_tool: () => ({ success: true }) });

  const res = await runFrameworkLoop({
    ...BASE,
    messages: [{ role: "user", content: "测试" }],
    llm,
    registry: reg,
    maxSteps: 2,
  });

  assert.equal(res.reply, "最终总结");
  // 强制总结轮不应携带工具定义
  const finalCall = llm.calls[llm.calls.length - 1];
  assert.ok(!finalCall.opts.tools || finalCall.opts.tools.length === 0);
  assert.ok(
    finalCall.messages.some(
      (m) => m.role === "user" && m.content.includes("不要再调用任何工具"),
    ),
  );
  // trace 记录强制总结步
  assert.equal(res.trace[res.trace.length - 1].action, "respond");
  assert.ok(res.trace[res.trace.length - 1].thought.includes("强制总结"));
});

test("情景记忆注入：命中小结话题时插到 system 人设之后", async () => {
  const llm = scriptedLLM([{ role: "assistant", content: "好的" }]);
  const { reg } = stubRegistry({});
  const digestRow = {
    summary: "复习了太阳系行星",
    topics: ["太阳系"],
    createdAt: 1,
  };
  const db = {
    collection: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => ({
            get: async () => ({ data: [digestRow] }),
          }),
        }),
      }),
    }),
  };

  const res = await runFrameworkLoop({
    ...BASE,
    messages: [
      { role: "system", content: "你是桥智同学" },
      { role: "user", content: "再讲讲太阳系吧" },
    ],
    db,
    llm,
    registry: reg,
  });

  const injected = llm.calls[0].messages[1];
  assert.equal(injected.role, "system");
  assert.ok(injected.content.includes("长期记忆"));
  assert.ok(injected.content.includes("太阳系行星"));
  assert.equal(res.reply, "好的");
});

test("情景记忆不命中：不注入任何额外 system 消息", async () => {
  const llm = scriptedLLM([{ role: "assistant", content: "好的" }]);
  const { reg } = stubRegistry({});
  const db = {
    collection: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => ({ get: async () => ({ data: [] }) }),
        }),
      }),
    }),
  };

  await runFrameworkLoop({
    ...BASE,
    messages: [
      { role: "system", content: "你是桥智同学" },
      { role: "user", content: "讲讲分数运算" },
    ],
    db,
    llm,
    registry: reg,
  });

  assert.equal(llm.calls[0].messages.length, 2);
});
