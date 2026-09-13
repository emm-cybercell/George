import { useState } from "react";
import { View, Text, Image } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import CustomTabBar from "@/components/CustomTabBar";
import InspirationCard from "@/components/Home/InspirationCard";
import FooterCards from "@/components/Home/FooterCards";
import { getLocalUserAccount } from "@/api/user";
import { vibrateIfEnabled } from "@/utils/settings";
import mascotImg from "@/assets/images/桥智同学.jpg";
import "./index.scss";

const Home = () => {
  const [streakDays, setStreakDays] = useState(0);
  const [level, setLevel] = useState(1);

  // 展示时读取成长数据（日记徽章与等级）
  useDidShow(() => {
    const acc = getLocalUserAccount();
    setStreakDays(acc.growth.streakDays || 0);
    setLevel(acc.growth.level || 1);
  });

  const goTo = (url: string) => {
    vibrateIfEnabled();
    Taro.navigateTo({ url });
  };

  return (
    <View className="home-page">
      {/* ① 极简吸顶 Header（右侧操作区完全避开微信胶囊） */}
      <View className="home-header">
        <View className="header-left">
          <Image
            className="header-left__avatar"
            src={mascotImg}
            mode="aspectFill"
          />
          <View className="header-left__text">
            <Text className="header-left__title">桥智同学</Text>
            <Text className="header-left__pill">AI 创意伙伴</Text>
          </View>
        </View>
        <View className="header-actions">
          <Text
            className="header-actions__icon"
            onClick={() => goTo("/pages/notifications/index")}
          >
            🔔
          </Text>
          <Text
            className="header-actions__icon"
            onClick={() => goTo("/pages/settings/index")}
          >
            ⚙️
          </Text>
        </View>
      </View>

      {/* ② Hero 灵感欢迎横幅 */}
      <View className="hero-banner">
        <View className="hero-banner__text">
          <Text className="hero-banner__title">你好，未来创造者 ✨</Text>
          <Text className="hero-banner__subtitle">
            让 AI 成为你的超级学习伙伴
          </Text>
          <View
            className="hero-banner__btn"
            onClick={() => goTo("/pages/learn/index")}
          >
            <Text>开始今日探索 ➔</Text>
          </View>
        </View>
        <Image
          className="hero-banner__mascot"
          src={mascotImg}
          mode="aspectFit"
        />
      </View>

      {/* ③ 核心特色 Bento Grid */}
      <View className="bento-section">
        <View className="bento-top-row">
          {/* 左侧大卡：实验室 */}
          <View
            className="bento-card-lab"
            onClick={() => goTo("/pages/feature-detail/index?type=lab")}
          >
            <View className="bento-card-lab__glow">✨ 动手创意工坊</View>
            <Text className="bento-card-lab__title">桥智实验室</Text>
            <Text className="bento-card-lab__sub">把奇思妙想变成现实作品</Text>
            <View className="bento-card-lab__btn">
              <Text>动手创作 ➔</Text>
            </View>
          </View>
          {/* 右侧上下堆叠小卡 */}
          <View className="bento-right-stack">
            <View
              className="bento-card-sub"
              onClick={() =>
                goTo("/pages/feature-detail/index?type=observation")
              }
            >
              <View className="bento-card-sub__icon bento-card-sub__icon--blue">
                🔍
              </View>
              <View className="bento-card-sub__text">
                <Text className="bento-card-sub__title">桥智观察站</Text>
                <Text className="bento-card-sub__desc">看懂 AI 新鲜事</Text>
              </View>
              <Text className="bento-card-sub__new">NEW</Text>
            </View>
            <View
              className="bento-card-sub"
              onClick={() =>
                goTo("/pages/feature-detail/index?type=ask-future")
              }
            >
              <View className="bento-card-sub__icon bento-card-sub__icon--green">
                💬
              </View>
              <View className="bento-card-sub__text">
                <Text className="bento-card-sub__title">桥智问未来</Text>
                <Text className="bento-card-sub__desc">向 2035 提问</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 底部横向通栏：成长日记 */}
        <View
          className="bento-card-diary"
          onClick={() => goTo("/pages/feature-detail/index?type=diary")}
        >
          <View className="bento-card-diary__left">
            <Text className="bento-card-diary__icon">📓</Text>
            <View className="bento-card-diary__text">
              <Text className="bento-card-diary__title">桥智成长日记</Text>
              <Text className="bento-card-diary__desc">
                记录每一次思考与进步
              </Text>
            </View>
          </View>
          <View className="bento-card-diary__badges">
            <Text className="bento-card-diary__streak">
              🔥 已探索 {streakDays} 天
            </Text>
            <Text className="bento-card-diary__level">Lv.{level} 探索者</Text>
          </View>
        </View>
      </View>

      {/* ④ 每日灵感：直通学习页 */}
      <InspirationCard />

      {/* ⑤ 底部双栏功能区 */}
      <FooterCards />

      <CustomTabBar currentTab="home" />
    </View>
  );
};

export default Home;
