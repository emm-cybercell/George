/**
 * deepseekProxy 云函数本地测试
 * - mock wx-server-sdk（cloud.ai() + 审核放行）
 * - 验证对话链路、生图 t2i/i2i 双模式
 * 运行：node --test tests/deepseekProxy.spec.js
 */
const Module = require("module");

// 记录 cloud.ai() 的调用入参，用于断言参数透传
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
  console.log("=== 测试 1: 正常对话（hy3）===");
  const r1 = await cloudFn.main({
    messages: [
      { role: "system", content: "你是桥智同学" },
      { role: "user", content: "你好，请介绍一下自己" },
    ],
  });
  console.log("success:", r1.success, "| modelUsed:", r1.modelUsed);
  if (!r1.success || !r1.reply || r1.modelUsed !== "hy3")
    throw new Error("测试1失败");
  if (textCalls[textCalls.length - 1].model !== "hy3")
    throw new Error("生文模型未透传");
  if (!registeredTools.includes("award_growth_points"))
    throw new Error("Function Calling 工具未注册");

  console.log("\n=== 测试 2: 空消息 ===");
  const r2 = await cloudFn.main({ messages: [] });
  console.log("success:", r2.success);

  console.log("\n=== 测试 3: 文生图（t2i）===");
  const r3 = await cloudFn.main({
    type: "image",
    prompt: "赛博朋克小猫咪",
    mode: "t2i",
  });
  console.log("imageUrl:", r3.imageUrl, "modelUsed:", r3.modelUsed);
  if (!r3.success || !r3.imageUrl || r3.modelUsed !== "HY-Image-3.0-Plus-4090-Tob-v1.0")
    throw new Error("测试3失败");
  if (imageCalls[imageCalls.length - 1].images)
    throw new Error("t2i 不应携带垫图");

  console.log("\n=== 测试 4: 图生图（i2i，带垫图）===");
  const r4 = await cloudFn.main({
    type: "image",
    prompt: "把小猫改成水彩风格",
    mode: "i2i",
    imageBase64: "aGVsbG8=",
  });
  console.log("imageUrl:", r4.imageUrl, "modelUsed:", r4.modelUsed);
  if (!r4.success || !r4.imageUrl || r4.modelUsed !== "HY-Image-v3.0-I2I-ToB-v1.0.1")
    throw new Error("测试4失败");
  const i2iCall = imageCalls[imageCalls.length - 1];
  if (!i2iCall.images || i2iCall.images[0] !== "aGVsbG8=")
    throw new Error("i2i 垫图未透传");

  console.log("\n=== 测试 5: i2i 缺垫图应报错 ===");
  const r5 = await cloudFn.main({
    type: "image",
    prompt: "改风格",
    mode: "i2i",
  });
  if (r5.success) throw new Error("测试5失败：缺垫图却成功了");
  console.log("error:", r5.reply);

  console.log("\nALL TESTS PASSED ✅");
  process.exit(0);
})().catch((err) => {
  console.error("TEST FAILED ❌", err);
  process.exit(1);
});
