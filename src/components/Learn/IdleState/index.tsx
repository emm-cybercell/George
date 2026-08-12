import { View, Text, Image } from "@tarojs/components";
import PromptPill from "@/components/PromptPill";
import mascotImg from "../../../../assets/桥智同学.jpg";
import "./index.scss";

interface IdleStateProps {
  prompts: string[];
  onPrompt: (text: string) => void;
}

const IdleState = ({ prompts, onPrompt }: IdleStateProps) => {
  return (
    <View className="idle-state">
      <Image className="idle-state__mascot" src={mascotImg} mode="aspectFit" />
      <Text className="idle-state__greeting">你好！我是桥智同学 👏</Text>
      <View className="idle-state__prompts">
        {prompts.map((p) => (
          <PromptPill key={p} label={p} onTap={() => onPrompt(p)} />
        ))}
      </View>
    </View>
  );
};

export default IdleState;
