/**
 * ReAct Agent 调度引擎
 * - wxai 协议：wx-server-sdk ≥4.0.1 cloud.ai() + registerFunctionTool，
 *   generateText(maxSteps) 由 SDK 自动执行工具循环（旧 callOpenAI 接口已下线）
 * - 其他 HTTP 供应商：手动 Function Calling 循环（最多 3 轮防死循环）
 */
const { sendChatCompletion } = require("../llmClient");
const { TOOL_DEFINITIONS, TOOL_EXECUTORS } = require("../tools/index");

const MAX_LOOPS = 3;

/** 解析工具参数（含容错） */
function parseArgs(raw) {
  if (typeof raw === "object" && raw !== null) return raw;
  try {
    return JSON.parse(raw || "{}");
  } catch (err) {
    return { _parseError: String(err.message || err) };
  }
}

/**
 * wxai 协议：cloud.ai() 自动工具循环
 * 工具执行器经闭包注入 db/openid，执行记录收集到 executed
 */
async function runWxaiAgent({ messages, config, db, openid, cloud }) {
  const ai = cloud.ai();
  const executed = [];

  const fnTools = TOOL_DEFINITIONS.map((def) => ({
    name: def.function.name,
    description: def.function.description,
    parameters: def.function.parameters,
    fn: async (args) => {
      const record = { name: def.function.name, args, result: null };
      try {
        record.result = await TOOL_EXECUTORS[def.function.name]({
          db,
          openid,
          args: args || {},
        });
      } catch (err) {
        // 工具执行异常：把错误返回给模型自主降级，不中断生成
        console.error(`tool ${def.function.name} failed:`, err.message || err);
        record.result = { success: false, error: String(err.message || err) };
      }
      executed.push(record);
      return record.result;
    },
  }));
  fnTools.forEach((t) => ai.registerFunctionTool(t));

  const model = ai.createModel("cloudbase");
  const res = await model.generateText({
    model: config.model,
    messages,
    tools: fnTools,
    maxSteps: MAX_LOOPS,
    temperature: config.temperature ?? 0.7,
    // 快速失败：在云函数 30s 超时被杀前主动报错（如模型未开通会挂起直到超时）
    options: { timeout: 25000 },
  });
  if (res.error) {
    throw new Error(`wxai generateText 失败: ${JSON.stringify(res.error)}`);
  }
  return {
    reply: res.text || "我已经想了很久，请换个问法试试吧 ✨",
    executedTools: executed,
  };
}

/**
 * HTTP 供应商：手动 Function Calling 循环
 */
async function runHttpAgentLoop({ messages, config, db, openid }) {
  const history = [...messages];
  const executedTools = [];

  for (let i = 0; i < MAX_LOOPS; i++) {
    const res = await sendChatCompletion(history, config, {
      tools: TOOL_DEFINITIONS,
    });
    const { content, tool_calls } = res;

    // 无工具调用：直接作为最终回复
    if (!tool_calls || tool_calls.length === 0) {
      const finalText = content || "好的，我明白了。";
      return { reply: finalText, executedTools };
    }

    history.push({ role: "assistant", content: content || "", tool_calls });

    for (const call of tool_calls) {
      const name = call.function?.name || "";
      const args = parseArgs(call.function?.arguments);
      const toolResult = { name, args, result: null };
      try {
        const executor = TOOL_EXECUTORS[name];
        toolResult.result = executor
          ? await executor({ db, openid, args })
          : { success: false, error: `未注册工具: ${name}` };
      } catch (err) {
        console.error(`tool ${name} failed:`, err.message || err);
        toolResult.result = { success: false, error: String(err.message || err) };
      }
      executedTools.push(toolResult);
      history.push({
        role: "tool",
        tool_call_id: call.id || `${name}-${i}`,
        content: JSON.stringify(toolResult.result),
      });
    }
  }

  const lastAssistant = [...history]
    .reverse()
    .find((m) => m.role === "assistant" && m.content);
  return {
    reply: lastAssistant?.content || "我已经尝试了多次，请换个问法试试吧 ✨",
    executedTools,
  };
}

/**
 * 运行 Agent：按协议分发
 * @param {{ messages: Array, config: object, db: object, openid: string, cloud?: object }} ctx
 * @returns {{ reply: string, executedTools: Array }}
 */
async function runAgentLoop(ctx) {
  if (ctx.config.protocol === "wxai") {
    return runWxaiAgent(ctx);
  }
  return runHttpAgentLoop(ctx);
}

module.exports = { runAgentLoop, MAX_LOOPS };
