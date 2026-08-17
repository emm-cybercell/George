import { View, Text } from "@tarojs/components";
import CustomPageHeader from "@/components/CustomPageHeader";
import { pillars, ruleCards } from "./data";
import "./index.scss";

const About = () => {
  return (
    <View className="about">
      <CustomPageHeader title="关于桥智同学" />

      <View className="about__body">
        <View className="section-card card-animate">
          <Text className="section-card__badge">🌌 世界观</Text>
          <Text className="section-card__title">IP 故事背景</Text>
          <Text className="section-card__desc">
            2035 年的未来世界，AI 已经遍布生活的每个角落。桥智同学乘着时光飞船
            穿梭到今天的教室，只为寻找"第一批未来创造者"——也就是正在看这行字的你！
            他相信，这个时代最酷的魔法，是学会如何与 AI 一起创造。
          </Text>
        </View>

        <Text className="about__section-title">三大教学支柱</Text>
        {pillars.map((p) => (
          <View className="pillar-card card-animate" key={p.title}>
            <Text className="pillar-card__icon">{p.icon}</Text>
            <View className="pillar-card__text">
              <View className="pillar-card__head">
                <Text className="pillar-card__title">{p.title}</Text>
                <Text className="pillar-card__en">{p.en}</Text>
              </View>
              <Text className="pillar-card__desc">{p.desc}</Text>
            </View>
          </View>
        ))}

        <Text className="about__section-title">AI 作业红黄绿原则</Text>
        {ruleCards.map((r) => (
          <View
            className={`rule-card rule-card--${r.color} card-animate`}
            key={r.color}
          >
            <Text className="rule-card__zone">{r.zone}</Text>
            <View className="rule-card__tags">
              {r.examples.map((e) => (
                <Text className="rule-card__tag" key={e}>
                  {e}
                </Text>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default About;
