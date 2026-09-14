import Taro from "@tarojs/taro";
import {
  ABILITIES,
  ABILITY_STORAGE_KEY,
  DEFAULT_ABILITY_ID,
} from "@/types/ability";
import { getLocalUserAccount } from "@/api/user";

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

/** 云函数回复的结构化结果 */
export interface DeepSeekResult {
  reply: string;
  /** 使用的模型 */
  modelUsed: string;
  /** 本轮 Agent 执行的工具清单 */
  executedTools: Array<{ name: string; result: Record<string, unknown> }>;
  /** 知识库检索命中的话题标签（search_knowledge 工具返回） */
  topics: string[];
  /** 是否参考了知识库 */
  usedKnowledge: boolean;
  /** 本轮工具的用户可读标签（去重） */
  toolLabels: string[];
  /** 知识检索命中条数 */
  knowledgeHits: number;
}

/** 工具名 → 用户可读标签 */
const TOOL_LABELS: Record<string, string> = {
  search_knowledge: "📚 知识检索",
  recommend_challenge: "🎯 个性化推荐",
  summarize_session: "📝 学习小结",
  award_growth_points: "🌟 探索积分",
  save_creative_portfolio: "📁 作品归档",
};

/** 对话模型固定 hy3（成长计划免费包唯一可用生文模型） */
export async function fetchDeepSeekReply(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options: { webSearch?: boolean } = {},
): Promise<DeepSeekResult> {
  try {
    // 读取当前培养能力，动态注入 system prompt
    const abilityId =
      Taro.getStorageSync(ABILITY_STORAGE_KEY) || DEFAULT_ABILITY_ID;
    const currentAbility =
      ABILITIES.find((a) => a.id === abilityId) || ABILITIES[1];
    const abilityPrompt = `\n【当前重点培养侧重】：请在对话中特别贯彻"${currentAbility.name}"原则：${currentAbility.systemGuidance}`;
    // 用户年级画像（个性化回答难度与措辞）
    let gradePrompt = "";
    try {
      const account = getLocalUserAccount();
      if (account?.profile?.grade) {
        gradePrompt = `\n【用户画像】：${account.profile.grade}的学生，请用匹配该学段的词汇、例子和知识深度回答。`;
      }
    } catch {
      /* 档案读取失败则不注入年级 */
    }
    const systemPromptBase = `${SYSTEM_PROMPT}${gradePrompt}${abilityPrompt}`;
    // 联网模式提示（云函数会尝试 SDK 联网参数，此处双保险声明能力与时效要求）
    const webSearchPrompt = options.webSearch
      ? "\n【联网模式】：用户开启了联网搜索，请结合时效性信息回答，并注明信息可能随时间变化。"
      : "";
    const systemPrompt = `${systemPromptBase}${webSearchPrompt}`;

    // 通过云函数代理请求，避免 API Key 暴露在客户端
    const res = await Taro.cloud.callFunction({
      name: "deepseekProxy",
      data: {
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        ...(options.webSearch ? { webSearch: true } : {}),
      },
    });

    const result = res.result as {
      success: boolean;
      reply?: string;
      error?: string;
      errorDetail?: string;
      modelUsed?: string;
      executedTools?: Array<{
        name: string;
        result: { tags?: string[] } & Record<string, unknown>;
      }>;
    };
    if (result && result.success) {
      const executedTools = result.executedTools || [];
      // 汇总 search_knowledge 工具命中的话题标签与条数
      const searchCalls = executedTools.filter(
        (t) => t.name === "search_knowledge",
      );
      const topics = [
        ...new Set(searchCalls.flatMap((t) => t.result?.tags || [])),
      ];
      const knowledgeHits = searchCalls.reduce(
        (n, t) =>
          n +
          (Array.isArray(t.result?.results) ? (t.result.results as unknown[]).length : 0),
        0,
      );
      // 本轮实际执行的工具标签（去重、按发生顺序）
      const toolLabels = [
        ...new Set(
          executedTools
            .filter((t) => t.result?.success !== false || t.name === "search_knowledge")
            .map((t) => TOOL_LABELS[t.name])
            .filter(Boolean),
        ),
      ];
      return {
        reply: result.reply || "",
        modelUsed: result.modelUsed || "hy3",
        executedTools,
        topics,
        usedKnowledge: knowledgeHits > 0,
        toolLabels,
        knowledgeHits,
      };
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
