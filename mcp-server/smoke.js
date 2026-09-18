/**
 * MCP Server 冒烟测试：真实 stdio 会话（initialize → tools/list → tools/call）
 * 验证「宿主视角」的完整调用链；需要 TCB_* 环境变量（数据库凭据）
 * 运行：node mcp-server/smoke.js
 */
const { spawn } = require("child_process");

const child = spawn(process.execPath, [`${__dirname}/index.js`], {
  env: process.env,
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => reject(new Error(`rpc 超时: ${method}`)), 30000);
  });
}

(async () => {
  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.0.1" },
  });
  console.log("✓ initialize:", init.result.serverInfo.name);

  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const tools = await rpc("tools/list", {});
  const names = tools.result.tools.map((t) => t.name);
  console.log("✓ tools/list:", names.join(", "));
  const expected = [
    "search_knowledge",
    "recommend_challenge",
    "summarize_session",
    "award_growth_points",
    "save_creative_portfolio",
  ];
  const missing = expected.filter((n) => !names.includes(n));
  if (missing.length) throw new Error(`缺少工具: ${missing}`);

  const call = await rpc("tools/call", {
    name: "search_knowledge",
    arguments: { query: "乘除运算顺序" },
  });
  const text = call.result.content?.[0]?.text || "";
  console.log("✓ tools/call search_knowledge →", text.slice(0, 200));
  if (call.result.isError) throw new Error("工具调用失败");

  child.kill();
  console.log("\nMCP SMOKE PASSED ✅");
  process.exit(0);
})().catch((err) => {
  console.error("MCP SMOKE FAILED ❌", err);
  child.kill();
  process.exit(1);
});
