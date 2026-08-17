import { View, Text } from "@tarojs/components";
import CustomPageHeader from "@/components/CustomPageHeader";
import { mentors } from "./data";
import "./index.scss";

const Team = () => {
  return (
    <View className="team">
      <CustomPageHeader title="团队与理念" />

      <View className="team__body">
        <View className="quote-card card-animate">
          <Text className="quote-card__mark">"</Text>
          <Text className="quote-card__text">
            我们不教"会用工具"，我们培养"AI 时代的数字产品经理"。
          </Text>
        </View>

        <View className="section-card card-animate">
          <Text className="section-card__badge">🏢 孵化背景</Text>
          <Text className="section-card__desc">
            由深圳大学科技工作室孵化，扎根粤海校区，汇聚高校科研资源与一线教育实践，
            为青少年搭建通往 AI 时代的桥梁。
          </Text>
        </View>

        <Text className="team__section-title">🧑‍🏫 导师阵容</Text>
        {mentors.map((m) => (
          <View className="mentor-card card-animate" key={m.role}>
            <Text className="mentor-card__icon">{m.icon}</Text>
            <View className="mentor-card__text">
              <Text className="mentor-card__role">{m.role}</Text>
              <Text className="mentor-card__desc">{m.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default Team;
