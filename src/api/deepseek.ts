import Taro from "@tarojs/taro";
import {
  ABILITIES,
  ABILITY_STORAGE_KEY,
  DEFAULT_ABILITY_ID,
} from "@/types/ability";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `你是"桥智同学"，一位来自 2035 年的"未来创造者探险家"与青少年的 AI 学习同桌。你穿着紫绿相间的连帽衫，开朗、幽默且富有同理心。

【三大互动原则】
1. 平等对话：使用"同学"视角，绝不说教，用"我们一起来琢磨"代替"你应该"。
2. 启发探索：不直接给死板的作业答案。当面对请求直接给答案时，引导孩子拆解需求与思路。
3. 鼓励创作：鼓励孩子动手尝试，不怕出错，把翻车当成学习素材。

【语言与防线】
- 使用符合 8-14 岁青少年的中文表达，生动简洁，善用比喻与表情符号。
- 严格遵循"AI 作业红黄绿原则"：鼓励查资料（绿），引导过脑重做（黄），拒绝直接抄答案（红）。
- 严禁输出任何涉及暴力、色情、灰产或不良价值观的内容。`;

/** 对话模型固定 hy3（成长计划免费包唯一可用生文模型） */
export async function fetchDeepSeekReply(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  try {
    // 读取当前培养能力，动态注入 system prompt
    const abilityId =
      Taro.getStorageSync(ABILITY_STORAGE_KEY) || DEFAULT_ABILITY_ID;
    const currentAbility =
      ABILITIES.find((a) => a.id === abilityId) || ABILITIES[1];
    const abilityPrompt = `\n【当前重点培养侧重】：请在对话中特别贯彻"${currentAbility.name}"原则：${currentAbility.systemGuidance}`;
    const systemPrompt = `${SYSTEM_PROMPT}${abilityPrompt}`;

    // 通过云函数代理请求，避免 API Key 暴露在客户端
    const res = await Taro.cloud.callFunction({
      name: "deepseekProxy",
      data: {
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      },
    });

    const result = res.result as {
      success: boolean;
      reply?: string;
      error?: string;
      errorDetail?: string;
    };
    if (result && result.success) {
      return result.reply || "";
    }
    // 携带云端诊断详情，便于在 Toast 中定位云上配置问题
    throw new Error(
      result?.error
        ? `${result.error}${result.errorDetail ? `（${result.errorDetail}）` : ""}`
        : "服务响应异常",
    );
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "网络连接稍慢，请重试";
    console.error("云函数调用失败:", err);
    Taro.showToast({ title: message, icon: "none", duration: 2500 });
    throw err;
  }
}
