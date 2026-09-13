import { View, Text, Image } from "@tarojs/components";
import "./index.scss";

interface UserCardProps {
  nickName: string;
  grade: string;
  points: number;
  level: number;
  avatarUrl?: string;
  streakDays: number;
  checkedInToday: boolean;
  /** 未完善资料（游客态）：展示微信快捷登录引导 */
  isGuest: boolean;
  onEdit: () => void;
  onCheckIn: () => void;
}

const UserCard = ({
  nickName,
  grade,
  points,
  level,
  avatarUrl,
  streakDays,
  checkedInToday,
  isGuest,
  onEdit,
  onCheckIn,
}: UserCardProps) => {
  const stats = [
    { icon: "🎂", value: "10月12日", name: "生日" },
    { icon: "📚", value: grade, name: "学龄" },
    { icon: "⭐", value: String(points), name: "积分" },
  ];

  return (
    <View className="user-card card-animate">
      <View className="user-card__top">
        {avatarUrl ? (
          <Image
            className="user-card__avatar-img"
            src={avatarUrl}
            mode="aspectFill"
          />
        ) : (
          <Text className="user-card__avatar">🧑‍🚀</Text>
        )}
        <View className="user-card__info">
          <Text className="user-card__name">{nickName}</Text>
          <Text className="user-card__level">LV.{level} 学习达人</Text>
        </View>
        <View
          className={`user-card__edit ${
            isGuest ? "user-card__edit--guest" : ""
          }`}
          onClick={onEdit}
        >
          {isGuest ? "点击微信快捷登录 →" : "✏️ 编辑档案"}
        </View>
      </View>

      <View className="user-card__checkin">
        <Text className="user-card__streak">🔥 已连续探索 {streakDays} 天</Text>
        <View
          className={`user-card__checkin-btn ${
            checkedInToday ? "user-card__checkin-btn--done" : ""
          }`}
          onClick={checkedInToday ? undefined : onCheckIn}
        >
          {checkedInToday ? "已打卡 ✓" : "今日打卡"}
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
