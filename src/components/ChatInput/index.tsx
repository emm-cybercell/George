import { View, Text, Input } from "@tarojs/components";
import "./index.scss";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
}

const ChatInput = ({ value, onChange, onSend }: ChatInputProps) => {
  return (
    <View className="chat-input">
      <Input
        className="chat-input__field"
        placeholder="有什么我能帮您的吗？"
        value={value}
        onInput={(e) => onChange(e.detail.value)}
        confirmType="send"
        onConfirm={onSend}
      />
      <Text className="chat-input__mic">🎙️</Text>
      <View className="chat-input__send" onClick={onSend}>
        ➤
      </View>
    </View>
  );
};

export default ChatInput;
