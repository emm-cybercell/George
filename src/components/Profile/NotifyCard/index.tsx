import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

const NotifyCard = () => {
  const onTap = () => {
    Taro.navigateTo({ url: "/pages/notifications/index" });
  };

  return (
    <View className="notify-card card-animate" onClick={onTap}>
      <Text className="notify-card__icon">🔔</Text>
      <View className="notify-card__text">
        <Text className="notify-card__label">消息通知</Text>
        <Text className="notify-card__sub">查看系统消息与活动提醒</Text>
      </View>
      <Text className="notify-card__badge">3</Text>
      <Text className="notify-card__arrow">›</Text>
    </View>
  );
};

export default NotifyCard;
