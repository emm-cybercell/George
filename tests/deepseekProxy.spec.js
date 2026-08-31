/**
 * deepseekProxy 云函数本地测试
 * - mock wx-server-sdk（openapi 审核放行）
 * - 真实调用 DeepSeek API 验证链路
 * 运行：node tests/deepseekProxy.spec.js
 */
const Module = require("module");
const path = require("path");

// mock wx-server-sdk
const WX_MOCK = {
  DYNAMIC_CURRENT_ENV: "local-test",
  init() {},
  getWXContext() {
    return { OPENID: "test-openid" };
  },
  openapi: {
    security: {
      msgSecCheck: async () => ({ errCode: 0 }), // 放行
    },
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "wx-server-sdk") return WX_MOCK;
  return originalLoad.apply(this, arguments);
};

const cloudFn = require("../cloudfunctions/deepseekProxy/index.js");

(async () => {
  console.log("=== 测试 1: 正常对话 ===");
  const r1 = await cloudFn.main({
    messages: [
      { role: "system", content: "你是桥智同学" },
      { role: "user", content: "你好，请介绍一下自己" },
    ],
  });
  console.log("success:", r1.success);
  console.log("reply:", r1.reply ? r1.reply.slice(0, 80) + "..." : r1.error);
  if (!r1.success || !r1.reply) throw new Error("测试1失败");

  console.log("\n=== 测试 2: 空消息 ===");
  const r2 = await cloudFn.main({ messages: [] });
  console.log("success:", r2.success);

  console.log("\nALL TESTS PASSED ✅");
  process.exit(0);
})().catch((err) => {
  console.error("TEST FAILED ❌", err);
  process.exit(1);
});
