import Taro from "@tarojs/taro";

export type BigModelContent = string | Array<any>;

export interface BigModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  // content can be a simple string or multimodal content array per 智谱文档
  content: BigModelContent;
}

export interface BigModelOptions {
  model?: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  reasoning_effort?: string;
  thinking?: any;
  max_tokens?: number;
}

/**
 * Call Zhipu/BigModel Chat Completion API (非流式默认)
 * - apiKey 可通过参数传入，或从环境/本地存储读取
 * - 不要把真实 key 提交到仓库；建议使用云函数代理以避免在客户端暴露
 */
export async function callBigModelChat(
  messages: BigModelMessage[],
  apiKey?: string,
  opts?: BigModelOptions,
): Promise<any> {
  try {
    const key =
      apiKey ||
      process.env.BIGMODEL_API_KEY ||
      (Taro && Taro.getStorageSync && Taro.getStorageSync("BIGMODEL_API_KEY"));
    if (!key) {
      throw new Error(
        "BigModel API key not provided. Set BIGMODEL_API_KEY in env or pass apiKey",
      );
    }

    const payload: any = {
      model: opts?.model || "glm-5.3-flash",
      messages,
      temperature: opts?.temperature ?? 1,
      top_p: opts?.top_p ?? 0.95,
      reasoning_effort: opts?.reasoning_effort ?? "max",
      thinking: opts?.thinking ?? { type: "enabled", clear_thinking: false },
      stream: opts?.stream ?? false,
    };
    if (opts?.max_tokens) payload.max_tokens = opts.max_tokens;

    const res = await Taro.request({
      url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      method: "POST",
      header: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      data: payload,
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.data;
    }

    // 抛出错误以便调用方处理
    throw new Error(
      `BigModel API error: ${res.statusCode} ${JSON.stringify(res.data)}`,
    );
  } catch (err) {
    console.error("callBigModelChat error:", err);
    throw err;
  }
}

// Usage example (do NOT include your real key in source):
// import { callBigModelChat } from '@/api/bigmodel';
// const messages = [{ role: 'user', content: '你好，介绍一下自己' }];
// const resp = await callBigModelChat(messages);
// console.log(resp);
