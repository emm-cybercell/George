import { View, Text } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import UserCard from "@/components/Profile/UserCard";
import ProfileEditor from "@/components/Profile/ProfileEditor";
import NotifyCard from "@/components/Profile/NotifyCard";
import AbilityCard from "@/components/Profile/AbilityCard";
import BadgeWall from "@/components/Profile/BadgeWall";
import MenuList from "@/components/Profile/MenuList";
import CustomTabBar from "@/components/CustomTabBar";
import {
  getLocalUserAccount,
  getOrInitUserAccount,
  handleDailyCheckIn,
  updateUserProfile,
} from "@/api/user";
import { useState } from "react";
import type { FullUserAccount, UserGrade } from "@/types";
import "./index.scss";

/** 今日日期 YYYY-MM-DD（打卡状态判定） */
const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const Profile = () => {
  const [account, setAccount] = useState<FullUserAccount | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  // 页面展示时云优先读取真实档案（首次自动建档），失败静默走本地默认
  useDidShow(() => {
    getOrInitUserAccount()
      .then((acc) => {
        setAccount(acc);
        setLoaded(true);
      })
      .catch((err) => {
        console.warn("档案读取失败，使用本地默认:", err);
        setLoaded(true);
      });
  });

  const checkedInToday =
    !!account?.growth.lastCheckInDate &&
    account.growth.lastCheckInDate === todayStr();

  // 今日打卡：+20 积分、连续天数 +1，云端同步自动完成
  const handleCheckIn = async () => {
    const result = await handleDailyCheckIn();
    setAccount(getLocalUserAccount());
    if (result.success) {
      Taro.showToast({
        title: `打卡成功 +${result.pointsGained} 积分 🎉`,
        icon: "none",
      });
      if (result.newlyUnlockedBadges.length > 0) {
        Taro.showToast({ title: "🏅 解锁新勋章！", icon: "none" });
      }
    } else {
      Taro.showToast({ title: "今天已经打过卡啦 ✨", icon: "none" });
    }
  };

  // 保存编辑：同步云端 + 更新本地缓存后刷新页面状态
  const handleSaveProfile = async (patch: {
    nickName: string;
    grade: UserGrade;
  }) => {
    const updated = await updateUserProfile(patch);
    setAccount(updated);
    setEditing(false);
    Taro.showToast({ title: "档案已更新 ✨", icon: "none" });
  };

  return (
    <View className="profile">
      <View className="profile__header">
        <Text className="profile__title">我的</Text>
      </View>

      <View
        className={
          loaded ? "profile__body" : "profile__body profile__body--loading"
        }
      >
        {account && (
          <UserCard
            nickName={account.profile.nickName}
            grade={account.profile.grade}
            points={account.growth.points}
            level={account.growth.level}
            avatarUrl={account.profile.avatarUrl || undefined}
            streakDays={account.growth.streakDays || 0}
            checkedInToday={checkedInToday}
            onEdit={() => setEditing(true)}
            onCheckIn={handleCheckIn}
          />
        )}
        <AbilityCard />
        <NotifyCard />
        <BadgeWall unlockedIds={account?.growth.unlockedBadges} />
        <MenuList />
      </View>

      {editing && account && (
        <ProfileEditor
          nickName={account.profile.nickName}
          grade={account.profile.grade}
          onCancel={() => setEditing(false)}
          onSave={handleSaveProfile}
        />
      )}

      <CustomTabBar currentTab="profile" />
    </View>
  );
};

export default Profile;
