import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import heroImg from "../../../../assets/images/首页.jpg";
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
      <Image className="hero__mascot" src={heroImg} mode="aspectFit" />
    </View>
  );
};

export default Hero;
