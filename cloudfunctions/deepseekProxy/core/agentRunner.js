/**
 * ReAct Agent 调度引擎（wxai 协议）
 * - wx-server-sdk ≥4.0.1 cloud.ai() + registerFunctionTool，
 *   generateText(maxSteps) 由 SDK 自动执行工具循环（旧 callOpenAI 接口已下线）
 * - 最大循环 3 轮（防死循环与超时）；工具执行失败回填给模型自主降级，绝不中断
 */
const { TOOL_DEFINITIONS, TOOL_EXECUTORS } = require("../tools/index");

const MAX_LOOPS = 3;

/** 单次生文尝试的超时（SDK 不生效时由外层 budget 兜底，见 hardTimeout） */
const ATTEMPT_TIMEOUT_MS = 20000;
/** 限流退避间隔 */
const RETRY_DELAY_MS = 1200;

/** 判断是否为限流错误（免费资源包 QPS 限制，SDK 底层抛 HTTP 429） */
function isRateLimitError(err) {
  const text = String(
    (err && (err.message || err)) || (err && JSON.stringify(err)) || "",
  );
  return /\b429\b|rate.?limit|too many requests|ECONNRESET/i.test(text);
}

/** 硬超时竞速：SDK 的 options.timeout 不生效时也能保证按时返回 */
function hardTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
}

/**
 * cloud.ai() 自动工具循环
 * 工具执行器经闭包注入 db/openid，执行记录收集到 executed
 * 限流（429）自动退避重试一次，仍失败抛出带提示的错误
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
  const invoke = () =>
    hardTimeout(
      model.generateText({
        model: config.model,
        messages,
        tools: fnTools,
        maxSteps: MAX_LOOPS,
        temperature: config.temperature ?? 0.7,
        options: { timeout: ATTEMPT_TIMEOUT_MS },
      }),
      ATTEMPT_TIMEOUT_MS,
      "generateText",
    );

  // 总预算 ≤ 2×20s + 1.2s ≈ 41s，云函数超时须 ≥ 60s（控制台配置）
  const startAt = Date.now();
  let res;
  try {
    res = await invoke();
  } catch (err) {
    if (
      !isRateLimitError(err) ||
      Date.now() - startAt + RETRY_DELAY_MS > ATTEMPT_TIMEOUT_MS * 2
    ) {
      throw err;
    }
    // 限流退避后重试一次（免费套餐 QPS 限制），重试前校验剩余预算
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    res = await invoke();
  }
  if (res.error) {
    throw new Error(`wxai generateText 失败: ${JSON.stringify(res.error)}`);
  }
  return {
    reply: res.text || "我已经想了很久，请换个问法试试吧 ✨",
    executedTools: executed,
  };
}

module.exports = { runAgentLoop, MAX_LOOPS };
