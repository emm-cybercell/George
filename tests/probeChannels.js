/**
 * 双通道实测：OpenAI compatible 与 Anthropic 端点（同 Key 同模型）
 * 运行：node tests/probeChannels.js
 */
const { DEFAULT_CONFIGS } = require("../cloudfunctions/deepseekProxy/config");
const {
  sendChatCompletion,
} = require("../cloudfunctions/deepseekProxy/llmClient");

const openaiCfg = {
  activeProvider: "aliyun",
  ...DEFAULT_CONFIGS.providers.aliyun,
};
const anthropicCfg = {
  activeProvider: "aliyunAnthropic",
  ...DEFAULT_CONFIGS.providers.aliyunAnthropic,
};

const messages = [
  { role: "system", content: "你是桥智同学" },
  { role: "user", content: "回复 OK" },
];

(async () => {
  console.log("=== 通道 1: OpenAI compatible (compatible-mode/v1) ===");
  try {
    const r1 = await sendChatCompletion(messages, openaiCfg);
    console.log("✅ 成功:", r1.trim().slice(0, 40));
  } catch (e) {
    console.log("❌ 失败:", e.message.slice(0, 160));
  }

  console.log("\n=== 通道 2: Anthropic (apps/anthropic) ===");
  try {
    const r2 = await sendChatCompletion(messages, anthropicCfg);
    console.log("✅ 成功:", r2.trim().slice(0, 40));
  } catch (e) {
    console.log("❌ 失败:", e.message.slice(0, 160));
  }
})();
