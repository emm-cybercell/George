import { View, Text, ScrollView } from "@tarojs/components";
import { badges } from "@/pages/profile/data";
import type { ProfileBadge } from "@/pages/profile/data";
import "./index.scss";

const BadgeWall = () => {
  return (
    <View className="badge-wall">
      <Text className="badge-wall__title">🏅 荣誉勋章</Text>
      <ScrollView scrollX className="badge-wall__list">
        {badges.map((badge: ProfileBadge) => (
          <View
            key={badge.id}
            className={`badge-wall__item badge-wall__item--${badge.styleType}`}
          >
            <Text className="badge-wall__icon">{badge.icon}</Text>
            <Text className="badge-wall__label">{badge.title}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default BadgeWall;
