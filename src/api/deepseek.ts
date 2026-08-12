import Taro from "@tarojs/taro";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 请替换为你的真实 DeepSeek API Key（platform.deepseek.com 获取） */
const DEEPSEEK_API_KEY = "YOUR_DEEPSEEK_API_KEY_HERE";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT = `你是"桥智同学"，一位来自 2035 年的"未来创造者探险家"与青少年的 AI 学习同桌。你穿着紫绿相间的连帽衫，开朗、幽默且富有同理心。

【三大互动原则】
1. 平等对话：使用"同桌"视角，绝不说教，用"我们一起来琢磨"代替"你应该"。
2. 启发探索：不直接给死板的作业答案。当面对请求直接给答案时，引导孩子拆解需求与思路。
3. 鼓励创作：鼓励孩子动手尝试，不怕出错，把翻车当成学习素材。

【语言与防线】
- 使用符合 8-14 岁青少年的中文表达，生动简洁，善用比喻与表情符号。
- 严格遵循"AI 作业红黄绿原则"：鼓励查资料（绿），引导过脑重做（黄），拒绝直接抄答案（红）。
- 严禁输出任何涉及暴力、色情、灰产或不良价值观的内容。`;

export async function fetchDeepSeekReply(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  try {
    const res = await Taro.request<{
      choices?: Array<{ message?: { content?: string } }>;
    }>({
      url: DEEPSEEK_URL,
      method: "POST",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      data: {
        model: "deepseek-chat",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.7,
      },
    });

    const reply = res.data?.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error("AI 没有返回内容，请稍后再试");
    }
    return reply;
  } catch (err) {
    Taro.showToast({
      title: "网络开小差了，请稍后再试 🙈",
      icon: "none",
    });
    throw err;
  }
}
