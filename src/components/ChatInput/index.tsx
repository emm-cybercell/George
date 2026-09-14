import { useState } from "react";
import { View, Input } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

const WEB_SEARCH_KEY = "web_search_enabled";

/** 读取联网搜索开关 */
export function isWebSearchEnabled(): boolean {
  try {
    return !!Taro.getStorageSync(WEB_SEARCH_KEY);
  } catch {
    return false;
  }
}

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
  const [webSearch, setWebSearch] = useState(isWebSearchEnabled());

  /** 点＋：打开能力面板；联网开启时显示 🌐 徽标 */
  const handlePlus = () => {
    onPlusTap();
  };

  /** 长按＋：切换联网搜索 */
  const toggleWebSearch = () => {
    const next = !webSearch;
    setWebSearch(next);
    try {
      Taro.setStorageSync(WEB_SEARCH_KEY, next);
    } catch {
      /* 存储失败仅影响本次记忆 */
    }
    Taro.showToast({
      title: next ? "联网搜索已开启 🌐" : "联网搜索已关闭",
      icon: "none",
    });
  };

  return (
    <View className="chat-input">
      <View
        className={`chat-input__plus ${webSearch ? "chat-input__plus--web" : ""}`}
        onClick={handlePlus}
        onLongPress={toggleWebSearch}
      >
        {webSearch ? "＋🌐" : "＋"}
      </View>
      <Input
        className="chat-input__field"
        placeholder={webSearch ? "联网模式：聊聊最新消息..." : "和桥智同桌聊点什么..."}
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
