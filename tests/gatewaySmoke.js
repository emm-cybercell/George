/**
 * 网关真实链路冒烟测试
 * - mock wx-server-sdk（cloud.ai() + 审核放行 + system_configs 无记录 → 默认兜底 wxai）
 * - 真实调用云函数 main，验证学习页对话链路可用
 * 运行：node tests/gatewaySmoke.js
 */
const Module = require("module");

const WX_MOCK = {
  DYNAMIC_CURRENT_ENV: "local-test",
  init() {},
  getWXContext() {
    return { OPENID: "smoke-test" };
  },
  ai() {
    return {
      createModel: () => ({
        generateText: async () => ({
          text: "我是桥智同学，未来创造者探险家！",
          messages: [],
          usage: {},
        }),
      }),
      createImageModel: () => ({
        generateImage: async () => ({
          data: [{ url: "https://example.com/fake.png" }],
        }),
      }),
      registerFunctionTool: () => {},
    };
  },
  openapi: {
    security: {
      msgSecCheck: async () => ({ errCode: 0 }), // 审核放行
    },
  },
  database: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => {
          throw new Error("no doc"); // 无 system_configs → 默认配置
        },
      }),
    }),
  }),
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "wx-server-sdk") return WX_MOCK;
  return originalLoad.apply(this, arguments);
};

const cloudFn = require("../cloudfunctions/deepseekProxy/index.js");

(async () => {
  const r = await cloudFn.main({
    messages: [
      { role: "system", content: "你是桥智同学" },
      { role: "user", content: "你好，请用一句话介绍你自己" },
    ],
  });
  console.log("success :", r.success);
  console.log("provider:", r.provider, "| model:", r.modelUsed);
  console.log("reply   :", r.reply ? r.reply.slice(0, 80) : r.error);
  process.exit(r.success ? 0 : 1);
})().catch((err) => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});
