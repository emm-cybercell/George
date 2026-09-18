/**
 * Tool Registry：工具注册中心（JSON Schema 驱动）
 * - 定义（schema，发给模型）与执行（handler，代码实现）统一注册
 * - ReAct 循环只依赖本模块，不感知具体工具 → 新增工具零侵入
 */
const { TOOL_DEFINITIONS, TOOL_EXECUTORS } = require("../../tools/index");

class ToolRegistry {
  constructor() {
    /** @type {Map<string, {schema: object, handler: Function, domain: string}>} */
    this.tools = new Map();
  }

  /**
   * 注册工具
   * @param {{name: string, description: string, parameters: object}} schema OpenAI function schema
   * @param {Function} handler async (ctx: {db, openid, args}) => result
   * @param {string} domain 工具域（knowledge / growth / portfolio）
   */
  register(schema, handler, domain = "general") {
    this.tools.set(schema.name, {
      schema: {
        type: "function",
        function: { name: schema.name, description: schema.description, parameters: schema.parameters },
      },
      handler,
      domain,
    });
    return this;
  }

  /** 从 tools/index.js 的定义+执行器映射批量注册 */
  registerAll(definitions, executors, domains = {}) {
    for (const def of definitions) {
      const fn = def.function;
      const handler = executors[fn.name];
      if (!handler) continue; // 定义无执行器：跳过而非报错
      this.register(fn, handler, domains[fn.name] || "general");
    }
    return this;
  }

  has(name) {
    return this.tools.has(name);
  }

  /** 发给模型的 tools 数组（OpenAI 格式） */
  schemas() {
    return [...this.tools.values()].map((t) => t.schema);
  }

  /** 执行工具调用（统一容错：异常转为 error 结果回填模型，绝不中断循环） */
  async invoke(name, args, ctx) {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `未注册工具: ${name}` };
    }
    try {
      return await tool.handler({ ...ctx, args: args || {} });
    } catch (err) {
      console.error(`tool ${name} failed:`, err.message || err);
      return { success: false, error: String(err.message || err) };
    }
  }

  names() {
    return [...this.tools.keys()];
  }
}

/** 构建默认注册中心（加载全部业务工具） */
function createDefaultRegistry() {
  return new ToolRegistry().registerAll(TOOL_DEFINITIONS, TOOL_EXECUTORS, {
    search_knowledge: "knowledge",
    recommend_challenge: "knowledge",
    summarize_session: "knowledge",
    award_growth_points: "growth",
    save_creative_portfolio: "portfolio",
  });
}

module.exports = { ToolRegistry, createDefaultRegistry };
