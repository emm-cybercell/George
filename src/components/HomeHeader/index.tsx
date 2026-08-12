import { View, Text } from "@tarojs/components";
import "./index.scss";

const HomeHeader = () => {
  return (
    <View className="home-header">
      <View className="home-header__brand">
        <Text className="home-header__logo">桥智同学</Text>
        <Text className="home-header__slogan">青少年 AI 创意助手</Text>
      </View>
    </View>
  );
};

export default HomeHeader;
