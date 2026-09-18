/**
 * Plan-and-Execute 范式：先出计划再逐步执行（hello-agents Ch4 任务分解模式）
 * - 规划轮：LLM 输出 2-4 步计划（强制 JSON，失败退化为纯 ReAct）
 * - 执行轮：计划以 system 注入 ReAct 循环，工具调用围绕计划展开
 * - trace 首步记录完整计划，面试可展示"规划→执行"两阶段过程
 */
const { runFrameworkLoop } = require("../core/framework/loop");

const PLAN_SYSTEM = `你是学习任务的规划器。请针对学生的问题制定 2-4 步的简短执行计划，每步一句话（可包含需要查询的知识点或互动设计）。
只输出 JSON：{"steps":["步骤1","步骤2","步骤3"]}
若问题简单到无需拆解，steps 只给一步即可，不要过度规划。`;

/**
 * @param {object} opts 同 runFrameworkLoop，另需 opts.llm（chatJSON 能力）
 */
async function runPlanExecute(opts) {
  const { llm } = opts;
  if (!llm || !llm.chatJSON) {
    return runFrameworkLoop(opts); // 无规划能力：退化为 ReAct
  }

  const recentUser =
    [...(opts.messages || [])].reverse().find((m) => m.role === "user")
      ?.content || "";
  const startedAt = Date.now();
  let steps = [];
  try {
    const plan = await llm.chatJSON(
      [
        { role: "system", content: PLAN_SYSTEM },
        { role: "user", content: recentUser || "（无明确提问，正常陪伴对话）" },
      ],
      { temperature: 0.3 },
    );
    steps = (plan.steps || [])
      .slice(0, 4)
      .map((s) => String(s).slice(0, 60))
      .filter(Boolean);
  } catch {
    steps = []; // 规划失败不阻断，直接执行
  }

  const planTrace = {
    step: "plan",
    thought: steps.length ? steps.join(" → ") : "规划失败，直接执行",
    action: "plan",
    observation: "",
    durationMs: Date.now() - startedAt,
  };

  const messages = steps.length
    ? [
        ...opts.messages,
        {
          role: "system",
          content: `【执行计划】请围绕以下计划逐步完成任务，完成一步即可进入下一步：\n${steps
            .map((s, i) => `${i + 1}. ${s}`)
            .join("\n")}`,
        },
      ]
    : opts.messages;

  const res = await runFrameworkLoop({ ...opts, messages });
  res.trace = [planTrace, ...res.trace];
  return res;
}

module.exports = { runPlanExecute };
