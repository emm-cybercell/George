/**
 * 通用 OpenAI 兼容适配器：统一请求第三方供应商的 chat/completions
 * 微信云开发 AI 能力（wxai 协议）不走此文件，由 agentRunner 直接使用
 * wx-server-sdk ≥4.0.1 的 cloud.ai()（见 core/agentRunner.js）
 */
const axios = require("axios");

/**
 * Anthropic 兼容适配器（阿里云百炼 /apps/anthropic 端点）
 * 协议：POST {baseURL}/v1/messages，system 独立字段，鉴权 x-api-key
 */
async function sendAnthropicCompletion(messages, config) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const chat = messages.filter((m) => m.role !== "system");

  try {
    const res = await axios.post(
      `${config.baseURL}/v1/messages`,
      {
        model: config.model,
        max_tokens: config.max_tokens ?? 2048,
        temperature: config.temperature ?? 0.7,
        ...(system ? { system } : {}),
        messages: chat,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-06",
        },
        timeout: 30000,
      },
    );
    const content = (res.data?.content || []).map((b) => b.text || "").join("");
    if (!content) {
      throw new Error("模型未返回有效内容");
    }
    return content;
  } catch (err) {
    const detail = err.response?.data || err.message || "未知错误";
    throw new Error(
      `LLM 请求失败 [${config.activeProvider}]: ${JSON.stringify(detail)}`,
    );
  }
}

/**
 * 发送对话补全请求并解析生成文本（按 provider 协议分发，HTTP 兼容供应商）
 * @param {Array<{role:string;content:string}>} messages
 * @param {{ activeProvider:string; baseURL:string; apiKey:string; model:string; temperature?:number; max_tokens?:number; protocol?:string }} config
 * @param {object} [opts]
 * @param {Array} [opts.tools] 工具定义（Function Calling）
 * @returns {Promise<{content:string; tool_calls:Array}>}
 */
async function sendChatCompletion(messages, config, opts = {}) {
  if (config.protocol === "anthropic") {
    const text = await sendAnthropicCompletion(messages, config);
    return { content: text, tool_calls: [] };
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  // OpenRouter 聚合网关要求附加来源标识
  if (config.activeProvider === "openrouter") {
    headers["HTTP-Referer"] = "https://qiaozhi-learning.example.com";
    headers["X-Title"] = "桥智同学";
  }

  try {
    const res = await axios.post(
      `${config.baseURL}/chat/completions`,
      {
        model: config.model,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.max_tokens ?? 2048,
        // 部分供应商（如智谱 GLM）推荐 top_p；未配置时不发送
        ...(config.top_p != null ? { top_p: config.top_p } : {}),
        // Function Calling：传工具定义 + auto 自主决策
        ...(opts.tools && opts.tools.length
          ? { tools: opts.tools, tool_choice: "auto" }
          : {}),
      },
      {
        headers,
        timeout: 30000,
      },
    );
    const message = res.data?.choices?.[0]?.message || {};
    return {
      content: message.content ?? "",
      tool_calls: message.tool_calls || [],
    };
  } catch (err) {
    // 携带供应商返回的错误细节，便于排查
    const detail = err.response?.data || err.message || "未知错误";
    throw new Error(
      `LLM 请求失败 [${config.activeProvider}]: ${JSON.stringify(detail)}`,
    );
  }
}

module.exports = { sendChatCompletion };
