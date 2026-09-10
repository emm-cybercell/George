import Taro from "@tarojs/taro";
import { ABILITY_STORAGE_KEY, DEFAULT_ABILITY_ID } from "@/types/ability";
import { DEFAULT_GRADE } from "@/types";
import type { FullUserAccount, UserGrowth, UserProfile } from "@/types";

const USER_STORAGE_KEY = "user_account";

/** 默认档案：昵称"新星创造者"、默认学龄、默认能力"思维发散性" */
export const DEFAULT_USER_PROFILE: UserProfile = {
  nickName: "新星创造者",
  avatarUrl: "",
  grade: DEFAULT_GRADE,
};

/** 默认成长数据：初始积分 100、等级 1、默认解锁 3 枚徽章 */
export const DEFAULT_USER_GROWTH: UserGrowth = {
  points: 100,
  level: 1,
  currentAbility: DEFAULT_ABILITY_ID,
  unlockedBadges: ["1", "2", "3"],
};

const db = () => Taro.cloud.database();

/** 云能力是否可用 */
function cloudReady(): boolean {
  return !!Taro.cloud && !!Taro.cloud.database;
}

/** 读取本地缓存档案（无缓存时返回默认档案，保证界面永不白屏） */
export function getLocalUserAccount(): FullUserAccount {
  const raw = Taro.getStorageSync(USER_STORAGE_KEY);
  if (raw && raw.profile && raw.growth) {
    return raw as FullUserAccount;
  }
  return {
    profile: { ...DEFAULT_USER_PROFILE },
    growth: { ...DEFAULT_USER_GROWTH },
    updateTime: 0,
  };
}

function setLocalUserAccount(account: FullUserAccount): void {
  Taro.setStorageSync(USER_STORAGE_KEY, account);
  // 培养方向同步到本地 current_ability，供学习页注入引导
  Taro.setStorageSync(ABILITY_STORAGE_KEY, account.growth.currentAbility);
}

/** 查询云端最新档案（失败返回 null，不抛错） */
async function fetchCloudAccount(): Promise<FullUserAccount | null> {
  if (!cloudReady()) return null;
  try {
    const res = await db()
      .collection("users")
      .orderBy("updateTime", "desc")
      .limit(1)
      .get();
    const data = (res.data || []) as FullUserAccount[];
    return data[0] || null;
  } catch (err) {
    console.warn("users 云端读取失败:", err);
    return null;
  }
}

/**
 * 获取/初始化当前用户账号：云端存在则返回云端档案并缓存本地；
 * 首次进入（新用户）自动在云端创建默认档案；云端不可用静默降级本地。
 */
export async function getOrInitUserAccount(): Promise<FullUserAccount> {
  const local = getLocalUserAccount();
  if (!cloudReady()) return local;
  try {
    const found = await fetchCloudAccount();
    if (found) {
      setLocalUserAccount(found);
      return found;
    }
    const seed: FullUserAccount = {
      profile: { ...DEFAULT_USER_PROFILE },
      growth: { ...DEFAULT_USER_GROWTH },
      updateTime: Date.now(),
    };
    await db()
      .collection("users")
      .add({ data: { ...seed, updateTime: Date.now() } });
    setLocalUserAccount(seed);
    return seed;
  } catch (err) {
    console.warn("users 初始化失败，使用本地:", err);
    return local;
  }
}

/** 本地先行更新 + 云端同步（弱网时本地立即生效，云端失败静默兜底） */
export async function applyAndSync(
  mutate: (a: FullUserAccount) => FullUserAccount,
): Promise<FullUserAccount> {
  const next = mutate(getLocalUserAccount());
  setLocalUserAccount(next);
  if (!cloudReady()) return next;
  try {
    const cloud = await fetchCloudAccount();
    const data = { ...cloud, ...next, updateTime: Date.now() };
    if (cloud?._id) {
      await db().collection("users").doc(cloud._id).update({ data });
    } else {
      await db().collection("users").add({ data });
    }
  } catch (err) {
    console.warn("users 云端写入失败:", err);
  }
  return next;
}

/** 更新昵称/头像/学龄等基础档案，同步云端与本地缓存 */
export function updateUserProfile(
  profile: Partial<UserProfile>,
): Promise<FullUserAccount> {
  return applyAndSync((a) => ({
    ...a,
    profile: { ...a.profile, ...profile },
  }));
}

/** 更新积分/等级/培养方向/勋章等成长数据 */
export function updateUserGrowth(
  growth: Partial<UserGrowth>,
): Promise<FullUserAccount> {
  return applyAndSync((a) => ({
    ...a,
    growth: { ...a.growth, ...growth },
  }));
}

// 激励域（签到 / 对话积分 / 勋章解锁）实现在 rewards.ts，统一从此入口导出
export {
  handleDailyCheckIn,
  awardChatPoints,
  checkAbilitySwitchBadge,
} from "./rewards";
