import { View, Text } from "@tarojs/components";
import HomeHeader from "@/components/HomeHeader";
import Hero from "@/components/Home/Hero";
import InfoCard from "@/components/Home/InfoCard";
import CustomTabBar from "@/components/CustomTabBar";
import { features, teamTags } from "./data";
import "./index.scss";

const Home = () => {
  return (
    <View className="home">
      <HomeHeader />

      <Hero />

      <InfoCard badge="📖 项目介绍" title="关于桥智同学">
        <Text className="home__desc">
          培养 AI
          时代产品经理思维：帮助青少年学会定义问题、判断结果、表达自己，成为未来数字世界的主动创造者。
        </Text>
      </InfoCard>

      <InfoCard badge="🏫 团队理念" title="团队与理念" tags={teamTags}>
        <Text className="home__desc">
          由深圳大学科技工作室孵化，联合一线教育者与 AI 工程师共同打造。
        </Text>
      </InfoCard>

      <Text className="home__section-title">⚡ 核心特色</Text>
      {features.map((item) => (
        <InfoCard
          key={item.title}
          icon={item.icon}
          title={item.title}
          desc={item.desc}
        />
      ))}

      <CustomTabBar currentTab="home" />
    </View>
  );
};

export default Home;
