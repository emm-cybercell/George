import Taro from "@tarojs/taro";

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
