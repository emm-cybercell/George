import { View, Text, Image } from "@tarojs/components";
import thinkingImg from "../../../../assets/images/思考.jpg";
import "./index.scss";

const ThinkingState = () => {
  return (
    <View className="thinking-state">
      <Image
        className="thinking-state__mascot"
        src={thinkingImg}
        mode="aspectFit"
      />
      <View className="thinking-state__pulse">
        <Text className="thinking-state__text">桥智同学正在思考中...</Text>
      </View>
    </View>
  );
};

export default ThinkingState;
