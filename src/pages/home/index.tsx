import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import HomeHeader from "@/components/HomeHeader";
import Hero from "@/components/Home/Hero";
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

      <View className="entry-card card-animate" onClick={() => goTo("/pages/about/index")}>
        <View className="entry-card__left">
          <Text className="entry-card__badge entry-card__badge--purple">
            📖 项目介绍
          </Text>
          <Text className="entry-card__title">关于桥智同学</Text>
        </View>
        <Text className="entry-card__arrow">›</Text>
      </View>

      <View className="entry-card card-animate" onClick={() => goTo("/pages/team/index")}>
        <View className="entry-card__left">
          <Text className="entry-card__badge entry-card__badge--pink">
            🏫 团队理念
          </Text>
          <Text className="entry-card__title">团队与理念</Text>
          <View className="entry-card__tags">
            {teamTags.map((t) => (
              <Text className="entry-card__tag" key={t}>
                {t}
              </Text>
            ))}
          </View>
        </View>
        <Text className="entry-card__arrow">›</Text>
      </View>

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
            <View className="feature-card__title-row">
              <Text className="feature-card__title">{item.title}</Text>
              <Text
                className="feature-card__arrow"
                style={{ color: item.color }}
              >
                ›
              </Text>
            </View>
          </View>
        ))}
      </View>

      <CustomTabBar currentTab="home" />
    </View>
  );
};

export default Home;
