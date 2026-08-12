import { View, Text } from "@tarojs/components";
import UserCard from "@/components/Profile/UserCard";
import NotifyCard from "@/components/Profile/NotifyCard";
import BadgeWall from "@/components/Profile/BadgeWall";
import MenuList from "@/components/Profile/MenuList";
import CustomTabBar from "@/components/CustomTabBar";
import "./index.scss";

const Profile = () => {
  return (
    <View className="profile">
      <View className="profile__header">
        <Text className="profile__title">我的</Text>
      </View>

      <View className="profile__body">
        <UserCard />
        <NotifyCard />
        <BadgeWall />
        <MenuList />
      </View>

      <CustomTabBar currentTab="profile" />
    </View>
  );
};

export default Profile;
