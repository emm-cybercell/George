import { View, Text } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import UserCard from "@/components/Profile/UserCard";
import NotifyCard from "@/components/Profile/NotifyCard";
import AbilityCard from "@/components/Profile/AbilityCard";
import BadgeWall from "@/components/Profile/BadgeWall";
import MenuList from "@/components/Profile/MenuList";
import CustomTabBar from "@/components/CustomTabBar";
import {
  fetchCloudUserProfile,
  mergeAbilityFromCloud,
  setLocalUserProfile,
} from "@/api/cloud";
import { useState } from "react";
import "./index.scss";

const Profile = () => {
  const [loaded, setLoaded] = useState(false);

  // 云优先读取用户档案：培养方向合并本地、积分等级缓存本地；失败静默走本地默认
  useDidShow(() => {
    fetchCloudUserProfile()
      .then((profile) => {
        if (profile) {
          mergeAbilityFromCloud(profile.selectedAbilityId);
          setLocalUserProfile({
            score: profile.score,
            level: profile.level,
          });
        }
        setLoaded(true);
      })
      .catch((err) => {
        console.warn("云端档案读取失败，使用本地默认:", err);
        setLoaded(true);
      });
  });

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
        <UserCard />
        <AbilityCard />
        <NotifyCard />
        <BadgeWall />
        <MenuList />
      </View>

      <CustomTabBar currentTab="profile" />
    </View>
  );
};

export default Profile;
