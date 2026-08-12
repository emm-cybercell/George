import { View, Text } from "@tarojs/components";
import "./index.scss";

interface PromptPillProps {
  label: string;
  onTap: () => void;
}

const PromptPill = ({ label, onTap }: PromptPillProps) => {
  return (
    <View className="prompt-pill" onClick={onTap}>
      <Text>{label}</Text>
    </View>
  );
};

export default PromptPill;
