/**
 * LLM 客户端：直连 CloudBase OpenAI 兼容网关
 * 返回原始 assistant message（含 tool_calls），供手写 ReAct 循环消费
 * ——这是自研框架与 SDK 托管循环的核心区别：模型每次输出对代码完全透明
 */
const axios = require("axios");

const DEFAULT_TIMEOUT_MS = 20000;

/**
 * 创建 LLM 客户端
 * @param {{apiKey: string, baseURL: string, model: string, timeoutMs?: number}} cfg
 * @returns {{chat: (messages, opts) => Promise<AssistantMsg>, chatJSON: (messages, opts) => Promise<any>}}
 */
function createLLM(cfg) {
  const {
    apiKey,
    baseURL,
    model,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = cfg;
  if (!apiKey || !baseURL) {
    throw new Error(
      "LLM 网关未配置：需要 CB_GATEWAY_KEY / CB_GATEWAY_URL 环境变量",
    );
  }

  /**
   * 对话补全（返回原始 message：{role, content, tool_calls?}）
   * @param {Array} messages OpenAI 格式消息
   * @param {{tools?: Array, temperature?: number, forceJSON?: boolean, timeoutMs?: number}} opts
   */
  async function chat(messages, opts = {}) {
    const body = {
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      ...(opts.tools && opts.tools.length
        ? { tools: opts.tools, tool_choice: "auto" }
        : {}),
      ...(opts.forceJSON ? { response_format: { type: "json_object" } } : {}),
    };
    let lastErr;
    // 限流（429）退避重试一次，其余错误直接抛出（上层有整体预算控制）
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await axios.post(`${baseURL}/chat/completions`, body, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: opts.timeoutMs ?? timeoutMs,
        });
        const msg = res.data?.choices?.[0]?.message;
        if (!msg) throw new Error("网关返回空消息");
        return msg;
      } catch (err) {
        lastErr = err;
        const status = err.response?.status;
        if (status !== 429 || attempt === 1) break;
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
    const detail = lastErr.response?.data || lastErr.message || "未知错误";
    throw new Error(`LLM 网关请求失败: ${JSON.stringify(detail).slice(0, 200)}`);
  }

  /** 强制 JSON 输出并解析（Query 改写 / Reflection 自检等结构化场景） */
  async function chatJSON(messages, opts = {}) {
    const msg = await chat(messages, { ...opts, forceJSON: true });
    try {
      return JSON.parse(msg.content || "{}");
    } catch {
      const match = String(msg.content || "").match(/\{[\s\S]*\}/);
      if (!match) throw new Error("LLM 未返回合法 JSON");
      return JSON.parse(match[0]);
    }
  }

  return { chat, chatJSON };
}

module.exports = { createLLM };
