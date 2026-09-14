/**
 * Agent 工具汇总：定义 + 执行器映射
 * 定义见 definitions.js，执行器按域拆分在 executors/ 下
 */
const { TOOL_DEFINITIONS } = require("./definitions");
const { GROWTH_EXECUTORS } = require("./executors/growth");
const { PORTFOLIO_EXECUTORS } = require("./executors/portfolio");
const { KNOWLEDGE_EXECUTORS } = require("./executors/knowledge");

const TOOL_EXECUTORS = {
  ...GROWTH_EXECUTORS,
  ...PORTFOLIO_EXECUTORS,
  ...KNOWLEDGE_EXECUTORS,
};

module.exports = { TOOL_DEFINITIONS, TOOL_EXECUTORS };
