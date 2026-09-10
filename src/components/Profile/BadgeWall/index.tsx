import { View, Text, ScrollView } from "@tarojs/components";
import { BADGE_DEFINITIONS } from "@/types";
import "./index.scss";

interface BadgeWallProps {
  /** 已解锁勋章 id 列表（云端 growth.unlockedBadges） */
  unlockedIds?: string[];
}

const BadgeWall = ({ unlockedIds }: BadgeWallProps) => {
  const unlockedSet = unlockedIds || [];
  const unlockedCount = BADGE_DEFINITIONS.filter((b) =>
    unlockedSet.includes(b.id),
  ).length;
  const total = BADGE_DEFINITIONS.length;

  return (
    <View className="badge-wall card-animate">
      <View className="badge-wall__head">
        <Text className="badge-wall__title">🏅 荣誉勋章</Text>
        <Text className="badge-wall__progress">
          已解锁 {unlockedCount}/{total}
        </Text>
      </View>
      <ScrollView scrollX className="badge-wall__list">
        {BADGE_DEFINITIONS.map((badge) => {
          const unlocked = unlockedSet.includes(badge.id);
          return (
            <View
              key={badge.id}
              className={`badge-wall__item badge-wall__item--${
                unlocked ? badge.styleType : "locked"
              } ${unlocked ? "badge-wall__item--glow" : ""}`}
            >
              <Text className="badge-wall__icon">
                {unlocked ? badge.icon : "🔒"}
              </Text>
              <Text className="badge-wall__label">{badge.title}</Text>
              <Text className="badge-wall__desc">
                {unlocked ? "" : badge.description}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default BadgeWall;
