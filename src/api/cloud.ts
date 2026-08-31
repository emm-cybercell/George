import Taro from "@tarojs/taro";
import { ABILITY_STORAGE_KEY, DEFAULT_ABILITY_ID } from "@/types/ability";

/** 云端聊天记录 */
export interface CloudChatRecord {
  _id?: string;
  userQuery: string;
  aiReply: string;
  abilityMode: string;
  createTime: number;
}

/** 云端用户档案 */
export interface CloudUserProfile {
  _id?: string;
  selectedAbilityId: string;
  score: number;
  level: string;
  updateTime: number;
}

const db = () => Taro.cloud.database();

/** 云能力是否可用 */
function cloudReady(): boolean {
  return !!Taro.cloud && !!Taro.cloud.database;
}

/** 聊天记录写入云端（失败静默，本地已持久化） */
export async function saveChatRecordToCloud(
  record: Omit<CloudChatRecord, "createTime" | "_id">,
): Promise<void> {
  if (!cloudReady()) return;
  try {
    await db()
      .collection("chat_history")
      .add({
        data: { ...record, createTime: Date.now() },
      });
  } catch (err) {
    console.warn("chat_history 云端写入失败:", err);
  }
}

/** 查询云端聊天记录（云优先，本地兜底） */
export async function queryCloudChatRecords(): Promise<CloudChatRecord[]> {
  if (!cloudReady()) return [];
  try {
    const res = await db()
      .collection("chat_history")
      .orderBy("createTime", "desc")
      .limit(20)
      .get();
    return (res.data || []) as CloudChatRecord[];
  } catch (err) {
    console.warn("chat_history 云端读取失败:", err);
    return [];
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

/** 培养方向/档案同步云端（upsert：存在最新档案则更新该条，否则新增） */
export async function syncProfileToCloud(
  profile: Pick<CloudUserProfile, "selectedAbilityId" | "score" | "level">,
): Promise<void> {
  if (!cloudReady()) return;
  try {
    const latest = await fetchCloudUserProfile();
    const data = { ...profile, updateTime: Date.now() };
    if (latest?._id) {
      await db().collection("users").doc(latest._id).update({ data });
    } else {
      await db().collection("users").add({ data });
    }
  } catch (err) {
    console.warn("users 云端写入失败:", err);
  }
}

/** 读取云端用户档案（云优先，本地兜底初始化） */
export async function fetchCloudUserProfile(): Promise<CloudUserProfile | null> {
  if (!cloudReady()) return null;
  try {
    const res = await db()
      .collection("users")
      .orderBy("updateTime", "desc")
      .limit(1)
      .get();
    const data = (res.data || []) as CloudUserProfile[];
    return data[0] || null;
  } catch (err) {
    console.warn("users 云端读取失败:", err);
    return null;
  }
}

/** 云端同步后的本地培养方向合并写入 */
export function mergeAbilityFromCloud(abilityId?: string): void {
  if (!abilityId) {
    abilityId = DEFAULT_ABILITY_ID;
  }
  const localId = Taro.getStorageSync(ABILITY_STORAGE_KEY);
  if (!localId || localId === abilityId) {
    Taro.setStorageSync(ABILITY_STORAGE_KEY, abilityId);
  }
}

/** 本地档案缓存 key */
const PROFILE_STORAGE_KEY = "user_profile";

export interface LocalUserProfile {
  score: number;
  level: string;
}

export function getLocalUserProfile(): LocalUserProfile {
  const raw = Taro.getStorageSync(PROFILE_STORAGE_KEY);
  if (raw && typeof raw.score === "number" && raw.level) {
    return raw as LocalUserProfile;
  }
  return { score: 1280, level: "LV.3 学习达人" };
}

export function setLocalUserProfile(profile: LocalUserProfile): void {
  Taro.setStorageSync(PROFILE_STORAGE_KEY, profile);
}
