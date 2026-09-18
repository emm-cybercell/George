/**
 * ReAct Loop：手写 Agent 循环（自研框架核心，对应 hello-agents Ch4/Ch7）
 * - Reason → Act → Observe 显式循环：模型每轮输出对代码完全透明，全程产出 trace
 * - 与 SDK 托管循环（core/agentRunner.js）的区别：循环控制、终止判定、观察回填
 *   均由本文件显式实现 → 可单测、可讲、可扩展范式（patterns/）
 * - 工具执行异常由 registry.invoke 转为 error 观察回填模型，自主降级不中断
 * - 双重预算：maxSteps 步数上限 + 整体时间预算（云函数超时 60s 内强制返回）
 */
const { createLLM } = require("./llm");
const { createDefaultRegistry } = require("./registry");
const { recallRelevantDigests } = require("./memory");

/** 单次请求最大模型轮数（与 SDK maxSteps=3 对齐，成本可控） */
const MAX_STEPS = 3;
/** 整体时间预算：为前置/后置审核与记忆召回留出余量 */
const BUDGET_MS = 48000;
/** 单轮 LLM 调用超时 */
const STEP_TIMEOUT_MS = 20000;
/** 工具观察回填模型的截断长度（保护上下文预算） */
const MAX_OBS_CHARS = 2000;

function clip(text, n) {
  const s = String(text ?? "");
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

function parseArgs(raw) {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

/** 兜底答复：与旧链路文案一致，前端无感知 */
const FALLBACK_REPLY = "我已经想了很久，请换个问法试试吧 ✨";

/**
 * 手写 ReAct 循环
 * @param {object} opts
 * @param {Array} opts.messages 前端透传消息（首条为 system 人设）
 * @param {{model: string, temperature?: number}} opts.config 模型配置（config.js 产出）
 * @param {*} opts.db 云数据库实例（记忆召回与工具执行器共用）
 * @param {string} opts.openid 用户标识
 * @param {{chat: Function}} [opts.llm] LLM 客户端（依赖注入，测试用；缺省从网关环境变量构建）
 * @param {{schemas: Function, invoke: Function}} [opts.registry] 工具注册中心（依赖注入，测试用）
 * @param {number} [opts.maxSteps] 最大模型轮数
 * @param {number} [opts.budgetMs] 整体时间预算 ms
 * @returns {Promise<{reply: string, executedTools: Array, trace: Array}>}
 */
async function runFrameworkLoop({
  messages,
  config = {},
  db = null,
  openid = "",
  llm,
  registry,
  maxSteps = MAX_STEPS,
  budgetMs = BUDGET_MS,
}) {
  llm =
    llm ||
    createLLM({
      apiKey: process.env.CB_GATEWAY_KEY,
      baseURL: process.env.CB_GATEWAY_URL,
      model: config.model,
    });
  registry = registry || createDefaultRegistry();

  const deadline = Date.now() + budgetMs;
  const trace = [];
  const executed = [];
  const convo = [...messages];

  // —— 上下文工程：情景记忆注入（插入 system 人设之后；无 db/无相关记忆时零开销） ——
  const recentUser =
    [...convo].reverse().find((m) => m.role === "user")?.content || "";
  const memories = await recallRelevantDigests(db, openid, recentUser);
  if (memories.length) {
    const insertAt = convo[0] && convo[0].role === "system" ? 1 : 0;
    convo.splice(insertAt, 0, {
      role: "system",
      content: `【长期记忆·往期学习小结】（历史会话相关内容，仅用于衔接上下文）：\n${memories
        .map((m) => `- ${m}`)
        .join("\n")}`,
    });
  }

  for (let step = 1; step <= maxSteps; step++) {
    const remaining = deadline - Date.now();
    if (remaining < 4000) {
      throw new Error(`ReAct 循环整体预算耗尽（${budgetMs}ms）`);
    }
    const startedAt = Date.now();
    const msg = await llm.chat(convo, {
      tools: registry.schemas(),
      temperature: config.temperature ?? 0.7,
      timeoutMs: Math.min(STEP_TIMEOUT_MS, remaining),
    });
    const calls = msg.tool_calls || [];

    // 终止判定：无 tool_calls → 最终回答
    if (!calls.length) {
      trace.push({
        step,
        thought: clip(msg.content, 200),
        action: "respond",
        observation: "",
        durationMs: Date.now() - startedAt,
      });
      return {
        reply: msg.content || FALLBACK_REPLY,
        executedTools: executed,
        trace,
      };
    }

    // Act：assistant 消息（含 tool_calls）回填，再逐个执行工具并回填观察
    convo.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
    for (const call of calls) {
      const name = call.function?.name || "";
      const args = parseArgs(call.function?.arguments);
      const t0 = Date.now();
      const result = await registry.invoke(name, args, { db, openid, llm });
      const obs = JSON.stringify(result ?? null);
      executed.push({ name, args, result });
      trace.push({
        step,
        thought: clip(msg.content, 200),
        action: name,
        args,
        observation: clip(obs, 200),
        durationMs: Date.now() - t0,
      });
      convo.push({
        role: "tool",
        tool_call_id: call.id || "",
        content: clip(obs, MAX_OBS_CHARS),
      });
    }
  }

  // 步数预算耗尽：禁用工具强制总结，防止死循环
  const remaining = deadline - Date.now();
  if (remaining < 4000) {
    throw new Error(`ReAct 循环整体预算耗尽（${budgetMs}ms）`);
  }
  const finalMsg = await llm.chat(
    [
      ...convo,
      {
        role: "user",
        content:
          "（请直接基于以上工具观察结果总结并给出最终回答，不要再调用任何工具）",
      },
    ],
    {
      temperature: config.temperature ?? 0.7,
      timeoutMs: Math.min(STEP_TIMEOUT_MS, remaining),
    },
  );
  trace.push({
    step: maxSteps + 1,
    thought: "步数预算耗尽，强制总结",
    action: "respond",
    observation: "",
    durationMs: 0,
  });
  return {
    reply: finalMsg.content || FALLBACK_REPLY,
    executedTools: executed,
    trace,
  };
}

module.exports = { runFrameworkLoop, MAX_STEPS, BUDGET_MS, FALLBACK_REPLY };
