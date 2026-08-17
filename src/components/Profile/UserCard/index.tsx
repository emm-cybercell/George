import { View, Text } from "@tarojs/components";
import { userInfo, stats } from "@/pages/profile/data";
import "./index.scss";

const UserCard = () => {
  return (
    <View className="user-card card-animate">
      <View className="user-card__top">
        <Text className="user-card__avatar">🧑‍🚀</Text>
        <View className="user-card__info">
          <Text className="user-card__name">{userInfo.nickname}</Text>
          <Text className="user-card__level">{userInfo.level}</Text>
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
