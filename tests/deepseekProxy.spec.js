/**
 * deepseekProxy 云函数本地测试
 * - mock wx-server-sdk（cloud.ai() + 审核放行）
 * - 验证对话链路、对话模型切换白名单、生图模型切换
 * 运行：node --test tests/deepseekProxy.spec.js
 */
const Module = require("module");
const path = require("path");

// 记录 cloud.ai() 的调用入参，用于断言模型透传
const textCalls = [];
const imageCalls = [];
const registeredTools = [];

// mock wx-server-sdk
const WX_MOCK = {
  DYNAMIC_CURRENT_ENV: "local-test",
  init() {},
  getWXContext() {
    return { OPENID: "test-openid" };
  },
  ai() {
    return {
      createModel: () => ({
        generateText: async (opts) => {
          textCalls.push(opts);
          return {
            text: "你好呀，我是桥智同学 🌟",
            messages: [],
            usage: {},
          };
        },
      }),
      createImageModel: () => ({
        generateImage: async (opts) => {
          imageCalls.push(opts);
          return { data: [{ url: "https://example.com/fake.png" }] };
        },
      }),
      registerFunctionTool: (tool) => {
        registeredTools.push(tool.name);
      },
    };
  },
  openapi: {
    security: {
      msgSecCheck: async () => ({ errCode: 0 }), // 放行
    },
  },
  // system_configs 无记录 → getActiveLLMConfig 走默认配置回退
  database() {
    return {
      collection: () => ({
        doc: () => ({
          get: async () => ({ data: null }),
        }),
      }),
    };
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "wx-server-sdk") return WX_MOCK;
  return originalLoad.apply(this, arguments);
};

const cloudFn = require("../cloudfunctions/deepseekProxy/index.js");

(async () => {
  console.log("=== 测试 1: 正常对话（默认 hy4-preview）===");
  const r1 = await cloudFn.main({
    messages: [
      { role: "system", content: "你是桥智同学" },
      { role: "user", content: "你好，请介绍一下自己" },
    ],
  });
  console.log("success:", r1.success, "| modelUsed:", r1.modelUsed);
  if (!r1.success || !r1.reply || r1.modelUsed !== "hy4-preview")
    throw new Error("测试1失败");
  if (textCalls[textCalls.length - 1].model !== "hy4-preview")
    throw new Error("生文模型未透传");
  if (!registeredTools.includes("award_growth_points"))
    throw new Error("Function Calling 工具未注册");

  console.log("\n=== 测试 2: 空消息 ===");
  const r2 = await cloudFn.main({ messages: [] });
  console.log("success:", r2.success);

  console.log("\n=== 测试 3: 对话模型切换（hy3 白名单内）===");
  const r3 = await cloudFn.main({
    messages: [{ role: "user", content: "你好" }],
    model: "hy3",
  });
  console.log("modelUsed:", r3.modelUsed);
  if (!r3.success || r3.modelUsed !== "hy3") throw new Error("测试3失败");
  if (textCalls[textCalls.length - 1].model !== "hy3")
    throw new Error("模型未透传");

  console.log("\n=== 测试 4: 非法模型回退默认（hy4-preview）===");
  const r4 = await cloudFn.main({
    messages: [{ role: "user", content: "你好" }],
    model: "gpt-4o",
  });
  console.log("modelUsed:", r4.modelUsed);
  if (!r4.success || r4.modelUsed !== "hy4-preview")
    throw new Error("测试4失败");

  console.log("\n=== 测试 5: 生图模型切换 ===");
  const r5 = await cloudFn.main({
    type: "image",
    prompt: "赛博朋克小猫咪",
    model: "HY-Image-v3.0-I2I-ToB-v1.0.1",
  });
  console.log("imageUrl:", r5.imageUrl, "modelUsed:", r5.modelUsed);
  if (
    !r5.success ||
    r5.modelUsed !== "HY-Image-v3.0-I2I-ToB-v1.0.1" ||
    !r5.imageUrl
  )
    throw new Error("测试5失败");
  if (imageCalls[imageCalls.length - 1].model !== "HY-Image-v3.0-I2I-ToB-v1.0.1")
    throw new Error("生图模型未透传");

  console.log("\nALL TESTS PASSED ✅");
  process.exit(0);
})().catch((err) => {
  console.error("TEST FAILED ❌", err);
  process.exit(1);
});
