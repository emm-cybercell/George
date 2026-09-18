/**
 * Reflection 范式：初答后自检一轮再定稿（hello-agents Ch4 反思模式）
 * - 自检维度：① 红黄绿合规（不直接代写作业务答案） ② 学段语气适配 ③ 明显事实错误
 * - 自检不通过 → 按修订稿定稿；无 LLM 客户端/自检失败 → 退化为纯 ReAct（可用性优先）
 */
const { runFrameworkLoop, FALLBACK_REPLY } = require("../core/framework/loop");

const REFLECT_SYSTEM = `你是学习助手"桥智同学"的质检员。依据"AI 作业红黄绿原则"对草稿回答做自检：
- 红色（必须修订）：直接给出作业的完整答案而非引导思考；
- 黄色（允许）：给出提示与引导；
- 绿色（鼓励）：讲解思路与方法。
同时检查：语气是否匹配学生学段、是否有明显事实错误。
只输出 JSON：{"verdict":"pass"或"revise","issues":["问题1","问题2"],"revised":"修订后的完整回答（仅 verdict=revise 时提供）"}
要求：revised 保持原回答的称呼与风格，只修复问题，不得改变结论立场。`;

/** 单步 trace 里 observation 的截断长度（与 loop.js 口径一致） */
const TRACE_CLIP = 200;

function clip(text, n) {
  const s = String(text ?? "");
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

/**
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
  const startedAt = Date.now();
  let judge = null;
  try {
    judge = await llm.chatJSON(
      [
        { role: "system", content: REFLECT_SYSTEM },
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
    durationMs: Date.now() - startedAt,
  });
  if (revised) base.reply = revised;
  return base;
}

module.exports = { runReflection };
