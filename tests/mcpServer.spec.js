/**
 * MCP Server 工具清单测试（CI 安全：不触网、不需要凭据）
 * 验证 stdio 服务应答 initialize/tools/list 且 5 个工具定义完整
 * 运行：node --test tests/mcpServer.spec.js（需先 cd mcp-server && npm install）
 */
const { test } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("child_process");
const path = require("path");

function startServer() {
  const child = spawn(
    process.execPath,
    [path.join(__dirname, "../mcp-server/index.js")],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  const pending = new Map();
  let buf = "";
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
  const rpc = (method, params) =>
    new Promise((resolve, reject) => {
      const id = pending.size + Math.floor(Math.random() * 100000) + 1;
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`rpc 超时: ${method}`));
        }
      }, 8000);
    });
  return { child, rpc };
}

test("tools/list：5 个工具以 MCP 格式暴露且 schema 完整（无需凭据）", async () => {
  const { child, rpc } = startServer();
  try {
    const init = await rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "ci-test", version: "0.0.1" },
    });
    assert.equal(init.result.serverInfo.name, "george-tutor-tools");

    const tools = await rpc("tools/list", {});
    const names = tools.result.tools.map((t) => t.name);
    for (const expected of [
      "search_knowledge",
      "recommend_challenge",
      "summarize_session",
      "award_growth_points",
      "save_creative_portfolio",
    ]) {
      assert.ok(names.includes(expected), `缺少工具 ${expected}`);
    }
    for (const t of tools.result.tools) {
      assert.equal(t.inputSchema.type, "object");
      assert.ok(t.description && t.description.length > 5);
    }
  } finally {
    child.kill();
  }
});
