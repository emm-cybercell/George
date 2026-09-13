/**
 * ReAct Agent 调度引擎（wxai 协议）
 * - wx-server-sdk ≥4.0.1 cloud.ai() + registerFunctionTool，
 *   generateText(maxSteps) 由 SDK 自动执行工具循环（旧 callOpenAI 接口已下线）
 * - 最大循环 3 轮（防死循环与超时）；工具执行失败回填给模型自主降级，绝不中断
 */
const { TOOL_DEFINITIONS, TOOL_EXECUTORS } = require("../tools/index");

const MAX_LOOPS = 3;

/**
 * cloud.ai() 自动工具循环
 * 工具执行器经闭包注入 db/openid，执行记录收集到 executed
 */
async function runAgentLoop({ messages, config, db, openid, cloud }) {
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

module.exports = { runAgentLoop, MAX_LOOPS };
