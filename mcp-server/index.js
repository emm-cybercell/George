/**
 * 桥智同学 MCP Server（stdio 传输）
 * 「一次注册，多端复用」：直接复用小程序 Agent 云函数的同一份工具定义与执行器
 * （cloudfunctions/deepseekProxy/tools/），把 5 个工具暴露为 MCP 协议——
 * Claude Desktop / Cursor 等宿主即可调用与小程序完全一致的知识检索/推荐/积分能力。
 *
 * 凭据（按优先级）：
 * 1. 环境变量 TCB_SECRET_ID/TCB_SECRET_KEY/TCB_TOKEN + TCB_ENV_ID（本地演示：临时密钥）
 * 2. CloudRun 注入的 TENCENTCLOUD_* 运行时凭据（部署到云时代码零改动）
 * 数据库延迟初始化：tools/list 不需要凭据即可应答（CI 可测）。
 *
 * 启动：node mcp-server/index.js
 */
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

// 复用云函数的工具定义与执行器（单一事实来源）
const {
  TOOL_DEFINITIONS,
  TOOL_EXECUTORS,
} = require("../cloudfunctions/deepseekProxy/tools/index");

const SERVER_INFO = {
  name: "george-tutor-tools",
  version: "1.0.0",
};

/** MCP 宿主侧的伪用户标识（隔离个人材料库；正式部署可改为按宿主身份映射） */
const MCP_USER = process.env.MCP_USER || "mcp-demo-user";

let dbPromise = null;

/** 延迟初始化 CloudBase 数据库（首次工具调用时） */
function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const tcb = require("@cloudbase/node-sdk");
      const initOpts = { env: process.env.TCB_ENV_ID };
      if (process.env.TCB_SECRET_ID && process.env.TCB_SECRET_KEY) {
        initOpts.secretId = process.env.TCB_SECRET_ID;
        initOpts.secretKey = process.env.TCB_SECRET_KEY;
        if (process.env.TCB_TOKEN) initOpts.sessionToken = process.env.TCB_TOKEN;
      } // 否则依赖运行时注入凭据（CloudRun / 云函数内）
      const app = tcb.init(initOpts);
      return app.database();
    })().catch((err) => {
      dbPromise = null; // 失败允许重试
      throw err;
    });
  }
  return dbPromise;
}

const server = new Server(SERVER_INFO, {
  capabilities: { tools: {} },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS.map((def) => ({
    name: def.function.name,
    description: def.function.description,
    inputSchema: def.function.parameters,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const executor = TOOL_EXECUTORS[name];
  if (!executor) {
    return {
      content: [{ type: "text", text: `未注册工具: ${name}` }],
      isError: true,
    };
  }
  try {
    const db = await getDb();
    const result = await executor({ db, openid: MCP_USER, args: args || {} });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `工具执行失败: ${err.message || err}` }],
      isError: true,
    };
  }
});

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVER_INFO.name}] MCP server ready (stdio), tools: ${
    TOOL_DEFINITIONS.map((d) => d.function.name).join(", ")
  }`);
})().catch((err) => {
  console.error("MCP server 启动失败:", err);
  process.exit(1);
});
