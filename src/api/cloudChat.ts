import Taro from "@tarojs/taro";

/** 云端聊天记录 */
export interface CloudChatRecord {
  _id?: string;
  userQuery: string;
  aiReply: string;
  abilityMode: string;
  timestamp: number;
}

const db = () => Taro.cloud.database();

/** 云能力是否可用 */
function cloudReady(): boolean {
  return !!Taro.cloud && !!Taro.cloud.database;
}

/** 聊天记录写入云端（失败静默，本地已持久化备份） */
export async function saveChatRecordToCloud(
  record: Omit<CloudChatRecord, "timestamp" | "_id">,
): Promise<void> {
  if (!cloudReady()) return;
  try {
    await db()
      .collection("chat_history")
      .add({
        data: { ...record, timestamp: Date.now() },
      });
  } catch (err) {
    console.warn("chat_history 云端写入失败:", err);
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
