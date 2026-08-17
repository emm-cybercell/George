import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

const Hero = () => {
  const goLearn = () => {
    Taro.redirectTo({ url: "/pages/learn/index" });
  };

  return (
    <View className="hero card-animate">
      <View className="hero__text">
        <Text className="hero__title">👋 你好，未来创造者！</Text>
        <Text className="hero__subtitle">让 AI 成为你的超级学习伙伴</Text>
        <View className="hero__btn" onClick={goLearn}>
          ✨ 开始 AI 创作
        </View>
      </View>
      <Text className="hero__mascot">🤖</Text>
    </View>
  );
};

export default Hero;
