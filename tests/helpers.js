/**
 * 测试公共工具：脚本化 LLM stub / ToolRegistry stub / 基础参数
 * 供 reactLoop.spec.js 与 patterns.spec.js 复用
 */
const { ToolRegistry } = require("../cloudfunctions/deepseekProxy/core/framework/registry");

/** 脚本化 LLM stub：按调用次序返回预设消息，记录每次入参 */
function scriptedLLM(steps) {
  const calls = [];
  const llm = {
    calls,
    chat: async (messages, opts) => {
      calls.push({ messages, opts });
      const i = Math.min(calls.length - 1, steps.length - 1);
      return steps[i];
    },
  };
  // chatJSON：与生产 llm.js 同构（forceJSON + 解析）
  llm.chatJSON = async (messages, opts = {}) => {
    const msg = await llm.chat(messages, { ...opts, forceJSON: true });
    return JSON.parse(msg.content || "{}");
  };
  return llm;
}

/** 工具注册 stub：记录调用并返回预设结果 */
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

module.exports = { scriptedLLM, stubRegistry, BASE };
