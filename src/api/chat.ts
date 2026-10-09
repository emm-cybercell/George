/**
 * 对话域 API（合并模块）：模型调用 / SSE 流式 / 会话持久化 / 云端记录
 * - fetchDeepSeekReply：云函数全量链路（工具调用 + trace，知识问答走这条）
 * - streamChat：chat-relay SSE 流式（纯对话直通打字机渲染，失败自动降级全量）
 * - 会话持久化三层：本地 history（chat_history storage）/ 云端记录 cloudChat（chat_history 集合，
 *   一轮一档）/ 云端会话聚合 chatSessions（按 sessionId 组装多轮）
 * 原五个独立文件（deepseek/stream/cloudChat/chatSessions/history）按职责内聚合并
 */
import Taro from "@tarojs/taro";
import {
  ABILITIES,
  ABILITY_STORAGE_KEY,
  DEFAULT_ABILITY_ID,
} from "@/types/ability";
import { getLocalUserAccount } from "@/api/user";
import type { ChatMessage } from "@/components/Learn/types";

// ===== chat-relay 流式服务配置 =====
// 不配置（storage 无值）= 功能关闭，全部对话走云函数全量链路（默认安全态）

export interface RelayConfig {
  url: string;
  key: string;
}

const RELAY_STORAGE_KEY = "chat_relay_config";

export function saveRelayConfig(config: RelayConfig): void {
  Taro.setStorageSync(RELAY_STORAGE_KEY, config);
}

export function getRelayConfig(): RelayConfig | null {
  try {
    const raw = Taro.getStorageSync(RELAY_STORAGE_KEY);
    if (raw && raw.url && raw.key) return raw as RelayConfig;
    return null;
  } catch {
    return null;
  }
}

// ===== 模型调用（云函数全量链路）=====



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

// ===== SSE 流式对话（chat-relay 直通；失败由调用方降级全量）=====

export interface StreamResult {
  /** 完整回复文本（分块拼接后的最终结果） */
  text: string;
  /** 实际使用的链路：stream 成功 / fallback 走云函数全量 */
  via: "stream" | "fallback";
}

/**
 * 流式对话（SSE 分块接收）：
 * - 优先走 chat-relay（闲聊直通，打字机渐进渲染，onDelta 逐块回调）
 * - relay 未配置/请求失败 → 回退云函数全量链路（callFunction，工具调用+trace 完整）
 * 说明：wx.request enableChunked 的 onChunkReceived 逐块到达，需解码 SSE 帧
 */
export async function streamChat(
  messages: Array<{ role: "user" | "system" | "assistant"; content: string }>,
  onDelta: (delta: string) => void,
): Promise<StreamResult> {
  const relay = getRelayConfig();
  if (!relay) return { text: "", via: "fallback" };

  return new Promise<StreamResult>((resolve) => {
    let text = "";
    let buffer = "";
    let settled = false;

    const task = Taro.request({
      url: `${relay.url}/chat`,
      method: "POST",
      header: { "Content-Type": "application/json", "X-API-Key": relay.key },
      enableChunked: true,
      data: { messages },
      timeout: 45000,
      success: () => {
        if (!settled) {
          settled = true;
          resolve(text ? { text, via: "stream" } : { text: "", via: "fallback" });
        }
      },
      fail: () => {
        if (!settled) {
          settled = true;
          resolve({ text: "", via: "fallback" });
        }
      },
    });

    if (task && typeof task.onChunkReceived === "function") {
      task.onChunkReceived((res: { data: ArrayBuffer | string }) => {
        const raw =
          typeof res.data === "string"
            ? res.data
            : new TextDecoder("utf-8").decode(res.data);
        buffer += raw;
        // SSE 帧以空行分隔；逐帧解析 data: 行
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") {
              if (!settled) {
                settled = true;
                resolve({ text, via: "stream" });
              }
              return;
            }
            try {
              const obj = JSON.parse(payload);
              if (obj.delta) {
                text += obj.delta;
                onDelta(obj.delta);
              }
              if (obj.error && !settled) {
                settled = true;
                task.abort();
                resolve({ text: "", via: "fallback" });
              }
            } catch {
              /* 非 JSON 帧忽略 */
            }
          }
        }
      });
    } else if (!settled) {
      // 低版本基础库不支持分块：立即回退
      settled = true;
      task.abort();
      resolve({ text: "", via: "fallback" });
    }
  });
}

// ===== 云端聊天记录（一轮问答一档）=====

/** 用户对 AI 回答的反馈 */
export interface ChatFeedback {
  liked: boolean | null;
}

/** 云端聊天记录（一条文档 = 一轮问答对） */
export interface CloudChatRecord {
  _id?: string;
  userQuery: string;
  aiReply: string;
  abilityMode: string;
  /** 关联会话 ID（串联多轮上下文） */
  sessionId?: string;
  /** 话题标签（来自知识库检索命中） */
  topics?: string[];
  /** AI 响应耗时 ms */
  responseTime?: number;
  /** 使用的模型 */
  modelUsed?: string;
  /** 用户反馈（默认 null 未评价） */
  feedback?: ChatFeedback;
  timestamp: number;
}

const db = () => Taro.cloud.database();

/** 云能力是否可用 */
function cloudReady(): boolean {
  return !!Taro.cloud && !!Taro.cloud.database;
}

/** 聊天记录写入云端，成功时返回文档 _id（供反馈回写定位；失败静默返回 null） */
export async function saveChatRecordToCloud(
  record: Omit<CloudChatRecord, "timestamp" | "_id">,
): Promise<string | null> {
  if (!cloudReady()) return null;
  try {
    const res = await db()
      .collection("chat_history")
      .add({
        data: { ...record, feedback: { liked: null }, timestamp: Date.now() },
      });
    return (res as { _id?: string })._id || null;
  } catch (err) {
    console.warn("chat_history 云端写入失败:", err);
    return null;
  }
}

/** 回写用户反馈（点赞/点踩）到指定记录 */
export async function updateChatFeedback(
  recordId: string,
  liked: boolean,
): Promise<void> {
  if (!cloudReady() || !recordId) return;
  try {
    await db()
      .collection("chat_history")
      .doc(recordId)
      .update({ data: { feedback: { liked } } as Partial<CloudChatRecord> });
  } catch (err) {
    console.warn("chat_history 反馈写入失败:", err);
  }
}

/** 查询云端聊天记录（云优先，本地兜底；倒序取前 30 条） */
export async function queryCloudChatRecords(): Promise<CloudChatRecord[]> {
  if (!cloudReady()) return [];
  try {
    const res = await db()
      .collection("chat_history")
      .orderBy("timestamp", "desc")
      .limit(30)
      .get();
    return (res.data || []) as CloudChatRecord[];
  } catch (err) {
    console.warn("chat_history 云端读取失败:", err);
    return [];
  }
}

/** 按 _id 读取单条云端聊天记录（historyId 会话恢复用，失败返回 null） */
export async function getCloudChatRecord(
  id: string,
): Promise<CloudChatRecord | null> {
  if (!cloudReady() || !id) return null;
  try {
    // ponytail: Taro 类型将 OQ/RQ 重载并成 void & Promise 交集，运行时实为 Promise，
    // 双断言绕开声明缺陷；升级 Taro 后如签名修正可去掉
    const res = (await db()
      .collection("chat_history")
      .doc(id)
      .get({})) as unknown as { data: CloudChatRecord };
    return res.data || null;
  } catch (err) {
    console.warn("chat_history 单条读取失败:", err);
    return null;
  }
}

/** 删除单条云端聊天记录（失败静默） */
export async function deleteCloudChatRecord(id: string): Promise<void> {
  if (!cloudReady() || !id) return;
  try {
    await db().collection("chat_history").doc(id).remove({});
  } catch (err) {
    console.warn("chat_history 云端删除失败:", err);
  }
}

/** 清空云端当前用户聊天记录 */
export async function clearCloudChatRecords(): Promise<void> {
  if (!cloudReady()) return;
  try {
    const collection = db().collection("chat_history");
    // ponytail: 客户端 remove 单次上限 20 条，循环删除直到云端无剩余记录；
    // 若需全量秒清可改走云函数 batchRemove，MVP 量级下循环足够
    for (;;) {
      const res = await collection.limit(20).get();
      const records = (res.data || []) as CloudChatRecord[];
      if (records.length === 0) return;
      await Promise.all(
        records
          .filter((r) => !!r._id)
          .map((r) => collection.doc(r._id as string).remove({})),
      );
    }
  } catch (err) {
    console.warn("chat_history 云端清空失败:", err);
  }
}

// ===== 云端会话聚合（sessionId → 多轮会话）=====

/** 按会话聚合的云端对话：一轮问答是一条文档，sessionId 串联同一会话的多轮 */
export interface CloudChatSession {
  /** 会话 ID（无 sessionId 的散记录用 solo-<记录id> 兜底，续聊写回同组） */
  id: string;
  title: string;
  updatedAt: number;
  /** 会话内全部轮次，按时间升序 */
  records: CloudChatRecord[];
}

/** 分页拉取当前用户全部聊天记录（跳过数按实际返回推进，兼容平台单次条数上限） */
async function fetchAllRecords(): Promise<CloudChatRecord[]> {
  const all: CloudChatRecord[] = [];
  let skip = 0;
  // 上限 1000 条防御失控；个人应用量级远达不到
  for (let page = 0; page < 10; page++) {
    const res = await db()
      .collection("chat_history")
      .orderBy("timestamp", "desc")
      .skip(skip)
      .limit(100)
      .get();
    const batch = (res.data || []) as CloudChatRecord[];
    if (batch.length === 0) break;
    all.push(...batch);
    skip += batch.length;
    if (batch.length < 100) break;
  }
  return all;
}

/** 纯函数：把散记录按 sessionId 聚合成会话列表（组内升序、组间按最新时间倒序） */
export function groupSessions(records: CloudChatRecord[]): CloudChatSession[] {
  const groups = new Map<string, CloudChatRecord[]>();
  for (const r of records) {
    const key = r.sessionId || `solo-${r._id}`;
    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([id, rs]) => {
      const asc = [...rs].sort((a, b) => a.timestamp - b.timestamp);
      const firstUser = asc.find((r) => !!r.userQuery.trim());
      return {
        id,
        title: firstUser?.userQuery || asc[0]?.userQuery || "对话",
        updatedAt: Math.max(...asc.map((r) => r.timestamp || 0)),
        records: asc,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 拉取并聚合云端会话（云能力不可用返回空数组，由页面降级本地） */
export async function queryCloudSessions(): Promise<CloudChatSession[]> {
  if (!cloudReady()) return [];
  try {
    return groupSessions(await fetchAllRecords());
  } catch (err) {
    console.warn("云端会话聚合失败:", err);
    return [];
  }
}

let idSeed = 0;

/** 云端记录 → 学习页消息流：还原 👍👎 反馈与 cloudRecordId，供消息行回写定位 */
export function cloudRecordsToMessages(
  records: CloudChatRecord[],
): ChatMessage[] {
  return records.flatMap((r) => [
    {
      id: `hist-${Date.now()}-${++idSeed}`,
      role: "user" as const,
      content: r.userQuery,
    },
    {
      id: `hist-${Date.now()}-${++idSeed}`,
      role: "assistant" as const,
      content: r.aiReply,
      liked: r.feedback?.liked ?? null,
      cloudRecordId: r._id,
    },
  ]);
}

/** 按 sessionId 读整段会话（时间升序；历史恢复用，失败返回空数组） */
export async function getCloudSessionRecords(
  sessionId: string,
): Promise<CloudChatRecord[]> {
  if (!cloudReady() || !sessionId) return [];
  try {
    const res = await db()
      .collection("chat_history")
      .where({ sessionId })
      .orderBy("timestamp", "asc")
      .get();
    return (res.data || []) as CloudChatRecord[];
  } catch (err) {
    console.warn("云端会话读取失败:", err);
    return [];
  }
}

/** 删除整段会话的云端记录（直接按组内记录 _id 删，散记录也能覆盖；失败静默） */
export async function deleteCloudSessionRecords(
  records: CloudChatRecord[],
): Promise<void> {
  if (!cloudReady() || records.length === 0) return;
  try {
    await Promise.all(
      records
        .filter((r) => !!r._id)
        .map((r) =>
          db().collection("chat_history").doc(r._id as string).remove({}),
        ),
    );
  } catch (err) {
    console.warn("云端会话删除失败:", err);
  }
}

// ===== 本地会话持久化 =====

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const STORAGE_KEY = "chat_history";

/** 取第一条用户消息做标题，截断为 12 字 */
export function buildTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "新对话";
  const text = first.content.trim();
  return text.length > 12 ? `${text.slice(0, 12)}…` : text;
}

export function getChatSessions(): ChatSession[] {
  const raw = Taro.getStorageSync(STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getChatSession(id: string): ChatSession | undefined {
  return getChatSessions().find((s) => s.id === id);
}

export function saveChatSession(session: ChatSession): void {
  const list = getChatSessions();
  const idx = list.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    list[idx] = session;
  } else {
    list.unshift(session);
  }
  Taro.setStorageSync(STORAGE_KEY, list);
}

export function deleteChatSession(id: string): void {
  const list = getChatSessions().filter((s) => s.id !== id);
  Taro.setStorageSync(STORAGE_KEY, list);
}

export function clearChatSessions(): void {
  Taro.removeStorageSync(STORAGE_KEY);
}
