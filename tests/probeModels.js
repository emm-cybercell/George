/**
 * 探测阿里云百炼工作台实际可用的模型名（逐个候选真实请求）
 * 运行：node tests/probeModels.js
 */
const { DEFAULT_CONFIGS } = require("../cloudfunctions/deepseekProxy/config");
const {
  sendChatCompletion,
} = require("../cloudfunctions/deepseekProxy/llmClient");
const axios = require("axios");

const base = DEFAULT_CONFIGS.providers.aliyun;

(async () => {
  // 先直接查询工作台模型清单（OpenAI 兼容标准 GET /models）
  try {
    const res = await axios.get(`${base.baseURL}/models`, {
      headers: { Authorization: `Bearer ${base.apiKey}` },
      timeout: 15000,
    });
    const ids = (res.data?.data || []).map((m) => m.id);
    console.log("📋 工作台模型总数:", ids.length);
    const picks = ids.filter((i) =>
      /deepseek-v4|qwen3\.5-flash|glm-5|minimax-m2\.5/i.test(i),
    );
    const testModels = picks.slice(0, 8);
    console.log("🧪 同 Key 实测模型:", testModels);
    console.log("");
    for (const model of testModels) {
      try {
        const reply = await sendChatCompletion(
          [{ role: "user", content: "回复 OK" }],
          { ...base, activeProvider: "aliyun", model, max_tokens: 16 },
        );
        console.log("✅ 可用:", model, "=>", reply.trim().slice(0, 24));
        process.exit(0);
      } catch (err) {
        const msg = err.message || "";
        console.log(
          "❌",
          model,
          "->",
          /Unpurchased|denied|not exist|not_found/i.test(msg)
            ? msg.slice(0, 72)
            : msg.slice(0, 90),
        );
      }
    }
    process.exit(1);
  } catch (err) {
    console.log(
      "模型列表接口不可用:",
      err.response?.data || err.message || err,
    );
    console.log("");
  }

  const candidates = [
    "deepseek-V4-Flash-0731",
    "deepseek-v4-flash-0731",
    "DeepSeek-V4-Flash-0731",
    "deepseek-chat",
    "deepseek-v3",
    "deepseek-v3.2",
    "deepseek-r1",
    "qwen-plus",
    "qwen-max",
    "qwen-turbo",
  ];

  for (const model of candidates) {
    try {
      const reply = await sendChatCompletion(
        [{ role: "user", content: "回复 OK" }],
        { ...base, activeProvider: "aliyun", model, max_tokens: 16 },
      );
      console.log("✅ 可用:", model, "=>", reply.trim().slice(0, 30));
      process.exit(0);
    } catch (err) {
      const msg = err.message || "";
      const reason = /model_not_found|Model not exist|Not exist/i.test(msg)
        ? "模型不存在"
        : msg.slice(0, 90);
      console.log("❌", model, "->", reason);
    }
  }
  console.log("\n候选均不可用，请到百炼控制台确认实际部署模型名");
  process.exit(1);
})();
