/**
 * 推理范式：event.pattern 决定本次对话走哪种编排
 * - react（默认）：单 ReAct 循环，成本最低
 * - reflection：初答后质检自检，合规性最好（红黄绿原则）
 * - plan_execute：先规划再执行，复杂任务结构最清晰
 * 未知范式回退 react（对外永不 4xx）
 */
const { runFrameworkLoop, FALLBACK_REPLY } = require("./core/framework/loop");
const { resolvePrompt } = require("./core/prompts");

/** 单步 trace 里 observation 的截断长度（与 loop.js 口径一致） */
const TRACE_CLIP = 200;

function clip(text, n) {
  const s = String(text ?? "");
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

// ===== react =====

async function runReact(opts) {
  return runFrameworkLoop(opts);
}

// ===== reflection（自检修订）=====

/**
 * 自检维度：① 红黄绿合规（不直接代写作业务答案） ② 学段语气适配 ③ 明显事实错误
 * 自检不通过 → 按修订稿定稿；无 LLM 客户端/自检失败 → 退化为纯 ReAct（可用性优先）
 * @param {object} opts 同 runFrameworkLoop，另需 opts.llm（chatJSON 能力）
 */
async function runReflection(opts) {
  const { llm } = opts;
  const base = await runFrameworkLoop(opts);
  if (!llm || !base.reply || base.reply === FALLBACK_REPLY) {
    return base; // 无客户端或空答复：无从自检
  }

  const recentUser =
    [...(opts.messages || [])].reverse().find((m) => m.role === "user")
      ?.content || "";
  // 质检 prompt 版本化灰度：DB 治理优先，内置兜底（core/prompts.js）
  const prompt = await resolvePrompt(opts.db, "reflect", opts.openid);
  const startedAt = Date.now();
  let judge = null;
  try {
    judge = await llm.chatJSON(
      [
        { role: "system", content: prompt.content },
        {
          role: "user",
          content: `【学生提问】${recentUser}\n【草稿回答】${base.reply}`,
        },
      ],
      { temperature: 0.2 },
    );
  } catch (err) {
    // 自检环节故障不阻断主链路，如实记录后返回初答
    base.trace.push({
      step: "reflection",
      thought: `自检失败：${clip(err.message || err, 120)}`,
      action: "pass",
      observation: "",
      durationMs: Date.now() - startedAt,
    });
    return base;
  }

  const revised =
    judge && judge.verdict === "revise" && judge.revised
      ? String(judge.revised)
      : null;
  base.trace.push({
    step: "reflection",
    thought:
      judge && judge.verdict === "revise"
        ? `自检发现：${clip((judge.issues || []).join("；") || "需修订", 160)}`
        : "自检通过",
    action: revised ? "revise" : "pass",
    observation: clip(revised || base.reply, TRACE_CLIP),
    // prompt 版本留痕：灰度效果在 trace 层可观察、可回溯
    promptVersion: `${prompt.source}:v${prompt.version}`,
    durationMs: Date.now() - startedAt,
  });
  if (revised) base.reply = revised;
  return base;
}

// ===== plan_execute（规划先行）=====

/**
 * 规划轮：LLM 输出 2-4 步计划（强制 JSON，失败退化为纯 ReAct）
 * 执行轮：计划以 system 注入 ReAct 循环，工具调用围绕计划展开
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
  // 规划 prompt 版本化灰度：DB 治理优先，内置兜底（core/prompts.js）
  const prompt = await resolvePrompt(opts.db, "plan", opts.openid);
  const startedAt = Date.now();
  let steps = [];
  try {
    const plan = await llm.chatJSON(
      [
        { role: "system", content: prompt.content },
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
    // prompt 版本留痕：灰度效果在 trace 层可观察、可回溯
    promptVersion: `${prompt.source}:v${prompt.version}`,
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

// ===== 选择器 =====

const PATTERNS = {
  react: runReact,
  reflection: runReflection,
  plan_execute: runPlanExecute,
};

function runPattern(name, opts) {
  const fn = PATTERNS[name] || runReact;
  return fn(opts);
}

module.exports = { runPattern, PATTERNS, runReact, runReflection, runPlanExecute };
