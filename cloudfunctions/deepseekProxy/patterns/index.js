/**
 * 范式选择器：event.pattern 决定本次对话走哪种推理范式
 * - react（默认）：单循环，成本最低
 * - reflection：初答后质检自检，合规性最好
 * - plan_execute：先规划再执行，复杂任务结构最清晰
 * 未知范式回退 react（对外永不 4xx）
 */
const { runReact } = require("./react");
const { runReflection } = require("./reflection");
const { runPlanExecute } = require("./plan-execute");

const PATTERNS = {
  react: runReact,
  reflection: runReflection,
  plan_execute: runPlanExecute,
};

function runPattern(name, opts) {
  const fn = PATTERNS[name] || runReact;
  return fn(opts);
}

module.exports = { runPattern, PATTERNS };
