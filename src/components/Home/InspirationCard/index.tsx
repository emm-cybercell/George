import { useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { pickFromKB, pickLocal } from "@/api/knowledge";
import "./index.scss";

/** 今日灵感探索卡：知识库随机抽题（云端优先，本地池兜底），点击预填充到学习页输入框 */
const InspirationCard = () => {
  const [questions, setQuestions] = useState<string[]>(() => pickLocal(2));
  const [cloudFirst, setCloudFirst] = useState(true);

  const refresh = () => {
    if (cloudFirst) {
      pickFromKB(2).then((items) => {
        if (items.length > 0) {
          setQuestions(items);
          return;
        }
        setCloudFirst(false);
        setQuestions(pickLocal(2));
      });
    } else {
      setQuestions(pickLocal(2));
    }
  };

  const goAsk = (q: string) => {
    Taro.navigateTo({
      url: `/pages/learn/index?prompt=${encodeURIComponent(q)}`,
    });
  };

  return (
    <View className="inspiration">
      <View className="inspiration__head">
        <Text className="inspiration__title">💡 今日灵感探索</Text>
        <Text className="inspiration__refresh" onClick={refresh}>
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
