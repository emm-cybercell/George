import { View, Text } from "@tarojs/components";
import { userInfo } from "@/pages/profile/data";
import { getLocalUserProfile } from "@/api/cloud";
import "./index.scss";

const UserCard = () => {
  const profile = getLocalUserProfile();
  const stats = [
    { icon: "🎂", value: "10月12日", name: "生日" },
    { icon: "📚", value: "五年级", name: "学龄" },
    { icon: "⭐", value: String(profile.score), name: "积分" },
  ];

  return (
    <View className="user-card card-animate">
      <View className="user-card__top">
        <Text className="user-card__avatar">🧑‍🚀</Text>
        <View className="user-card__info">
          <Text className="user-card__name">{userInfo.nickname}</Text>
          <Text className="user-card__level">{profile.level}</Text>
        </View>
      </View>

      <View className="user-card__stats">
        {stats.map((s) => (
          <View className="user-card__stat" key={s.name}>
            <Text className="user-card__stat-icon">{s.icon}</Text>
            <Text className="user-card__stat-value">{s.value}</Text>
            <Text className="user-card__stat-name">{s.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default UserCard;
