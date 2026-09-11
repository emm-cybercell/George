import { useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

/** 精选青少年脑洞灵感池 */
const INSPIRATIONS = [
  "🤖 如果火星上有学校，操场会是什么样子？",
  "🎨 怎么写魔法指令让 AI 画一只赛博朋克小猫？",
  "🚀 如果我能给太阳写信，第一句话会写什么？",
  "🌌 星星之间也有交通红绿灯吗？",
  "🧬 发明一台能闻到梦想的机器，需要哪些零件？",
  "🦕 如果恐龙会编程，它们会建什么样的城市？",
];

/** 随机取出 2 条灵感 */
const pickTwo = (): string[] => {
  const pool = [...INSPIRATIONS];
  const picks: string[] = [];
  while (picks.length < 2 && pool.length > 0) {
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picks;
};

/** 今日灵感探索卡：点击问题直达学习页发起提问 */
const InspirationCard = () => {
  const [questions, setQuestions] = useState<string[]>(pickTwo);

  const goAsk = (q: string) => {
    Taro.navigateTo({
      url: `/pages/learn/index?prompt=${encodeURIComponent(q)}`,
    });
  };

  return (
    <View className="inspiration">
      <View className="inspiration__head">
        <Text className="inspiration__title">💡 今日灵感探索</Text>
        <Text
          className="inspiration__refresh"
          onClick={() => setQuestions(pickTwo())}
        >
          🔀 换一换
        </Text>
      </View>
      {questions.map((q) => (
        <View key={q} className="inspiration__item" onClick={() => goAsk(q)}>
          <Text className="inspiration__item-text">{q}</Text>
          <Text className="inspiration__item-arrow">➔</Text>
        </View>
      ))}
    </View>
  );
};

export default InspirationCard;
