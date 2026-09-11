import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

const CARDS = [
  {
    icon: "📖",
    title: "关于桥智同学",
    sub: "青少年 AI 伙伴",
    url: "/pages/about/index",
  },
  {
    icon: "🏫",
    title: "团队与理念",
    sub: "深大科技孵化",
    url: "/pages/team/index",
  },
];

/** 首页底部双栏功能区 */
const FooterCards = () => (
  <View className="footer-cards">
    {CARDS.map((c) => (
      <View
        key={c.title}
        className="footer-cards__item"
        onClick={() => Taro.navigateTo({ url: c.url })}
      >
        <Text className="footer-cards__icon">{c.icon}</Text>
        <View className="footer-cards__text">
          <Text className="footer-cards__title">{c.title}</Text>
          <Text className="footer-cards__sub">{c.sub}</Text>
        </View>
        <Text className="footer-cards__arrow">›</Text>
      </View>
    ))}
  </View>
);

export default FooterCards;
