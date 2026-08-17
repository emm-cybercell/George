import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import HomeHeader from "@/components/HomeHeader";
import Hero from "@/components/Home/Hero";
import InfoCard from "@/components/Home/InfoCard";
import CustomTabBar from "@/components/CustomTabBar";
import { features, teamTags, type FeatureItem } from "./data";
import "./index.scss";

const Home = () => {
  const goTo = (url: string) => {
    Taro.navigateTo({ url });
  };

  const goFeature = (item: FeatureItem) => {
    goTo(`/pages/feature-detail/index?type=${item.type}`);
  };

  return (
    <View className="home">
      <HomeHeader />

      <Hero />

      <InfoCard
        badge="📖 项目介绍"
        title="关于桥智同学"
        onClick={() => goTo("/pages/about/index")}
      >
        <Text className="home__desc">
          培养 AI
          时代产品经理思维：帮助青少年学会定义问题、判断结果、表达自己，成为未来数字世界的主动创造者。
        </Text>
      </InfoCard>

      <InfoCard
        badge="🏫 团队理念"
        title="团队与理念"
        tags={teamTags}
        onClick={() => goTo("/pages/team/index")}
      >
        <Text className="home__desc">
          由深圳大学科技工作室孵化，联合一线教育者与 AI 工程师共同打造。
        </Text>
      </InfoCard>

      <Text className="home__section-title">⚡ 核心特色</Text>
      <View className="home__feature-grid">
        {features.map((item) => (
          <View
            key={item.type}
            className="feature-card card-animate"
            onClick={() => goFeature(item)}
          >
            <View
              className="feature-card__bar"
              style={{ background: item.color }}
            />
            <View
              className="feature-card__badge"
              style={{ background: item.color }}
            >
              <Text className="feature-card__icon">{item.icon}</Text>
            </View>
            <Text className="feature-card__title">{item.title}</Text>
            <Text className="feature-card__desc">{item.desc}</Text>
          </View>
        ))}
      </View>

      <CustomTabBar currentTab="home" />
    </View>
  );
};

export default Home;
