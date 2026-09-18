/**
 * ReAct 范式（默认）：Reason → Act → Observe 循环
 * 直接复用 framework/loop.js 的手写循环（单一事实来源，patterns 只做范式编排）
 */
const { runFrameworkLoop } = require("../core/framework/loop");

async function runReact(opts) {
  return runFrameworkLoop(opts);
}

module.exports = { runReact };
