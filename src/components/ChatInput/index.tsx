import { View, Input } from "@tarojs/components";
import "./index.scss";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isRecording: boolean;
  onMicTap: () => void;
  /** 点击 + 拓展工具箱 */
  onPlusTap: () => void;
}

const ChatInput = ({
  value,
  onChange,
  onSend,
  isRecording,
  onMicTap,
  onPlusTap,
}: ChatInputProps) => {
  return (
    <View className="chat-input">
      <View className="chat-input__plus" onClick={onPlusTap}>
        ＋
      </View>
      <Input
        className="chat-input__field"
        placeholder="和桥智同桌聊点什么..."
        maxlength={1000}
        value={value}
        onInput={(e) => onChange(e.detail.value)}
        confirmType="send"
        onConfirm={onSend}
      />
      <View
        className={`chat-input__mic ${isRecording ? "chat-input__mic--recording" : ""}`}
        onClick={onMicTap}
      >
        🎙️
      </View>
      <View className="chat-input__send" onClick={onSend}>
        ➤
      </View>
    </View>
  );
};

export default ChatInput;
