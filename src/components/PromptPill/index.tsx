import { View, Text } from "@tarojs/components";
import "./index.scss";

interface PromptPillProps {
  label: string;
  icon?: string;
  onTap: () => void;
}

const PromptPill = ({ label, icon, onTap }: PromptPillProps) => {
  return (
    <View className="prompt-pill" onClick={onTap}>
      {icon ? <Text className="prompt-pill__icon">{icon}</Text> : null}
      <Text className="prompt-pill__label">{label}</Text>
    </View>
  );
};

export default PromptPill;
