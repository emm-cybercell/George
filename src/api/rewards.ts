import { applyAndSync, getLocalUserAccount } from "./user";
import type { AwardChatResult, CheckInResult, UserGrowth } from "@/types";

/** 今日日期 YYYY-MM-DD */
function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 解锁勋章：未解锁则追加并记录 */
function unlockBadge(
  growth: UserGrowth,
  badgeId: string,
  newly: string[],
): void {
  if (!growth.unlockedBadges.includes(badgeId)) {
    growth.unlockedBadges = [...growth.unlockedBadges, badgeId];
    newly.push(badgeId);
  }
}

/** 每日签到：+20 积分、连续天数 +1；连续 3 天解锁 streak_3 */
export async function handleDailyCheckIn(): Promise<CheckInResult> {
  const today = todayStr();
  const g = getLocalUserAccount().growth;
  if (g.lastCheckInDate === today) {
    return {
      success: false,
      alreadyCheckedIn: true,
      pointsGained: 0,
      streakDays: g.streakDays || 0,
      newlyUnlockedBadges: [],
    };
  }
  const newly: string[] = [];
  const streakDays = (g.streakDays || 0) + 1;
  await applyAndSync((a) => {
    const growth = {
      ...a.growth,
      points: a.growth.points + 20,
      streakDays,
      lastCheckInDate: today,
    };
    if (streakDays >= 3) unlockBadge(growth, "streak_3", newly);
    return { ...a, growth };
  });
  return {
    success: true,
    pointsGained: 20,
    streakDays,
    newlyUnlockedBadges: newly,
  };
}

/** 对话激励：+10 积分、累计对话 +1、等级重算、解锁 first_chat/dialogue_5 */
export async function awardChatPoints(): Promise<AwardChatResult> {
  const newly: string[] = [];
  let isLevelUp = false;
  let newLevel = 1;
  await applyAndSync((a) => {
    const growth = {
      ...a.growth,
      points: a.growth.points + 10,
      totalChats: (a.growth.totalChats || 0) + 1,
    };
    newLevel = Math.floor(growth.points / 100) + 1;
    if (newLevel > (a.growth.level || 1)) {
      growth.level = newLevel;
      isLevelUp = true;
    }
    if (growth.totalChats === 1) unlockBadge(growth, "first_chat", newly);
    if (growth.totalChats >= 5) unlockBadge(growth, "dialogue_5", newly);
    return { ...a, growth };
  });
  return { pointsGained: 10, isLevelUp, newLevel, newlyUnlockedBadges: newly };
}

/** 培养方向切换联动：体验 >=2 种解锁 multi_talent */
export async function checkAbilitySwitchBadge(
  newAbilityId: string,
): Promise<{ newlyUnlockedBadges: string[] }> {
  const newly: string[] = [];
  await applyAndSync((a) => {
    const tried = a.growth.triedAbilities || [];
    if (tried.includes(newAbilityId)) return a;
    const growth = { ...a.growth, triedAbilities: [...tried, newAbilityId] };
    if (growth.triedAbilities.length >= 2) {
      unlockBadge(growth, "multi_talent", newly);
    }
    return { ...a, growth };
  });
  return { newlyUnlockedBadges: newly };
}
