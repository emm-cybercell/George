import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useUnload } from "@tarojs/taro";
import { stopCurrentVoice } from "@/utils/tts";
import MessageRow from "./MessageRow";
import type { ChatMessage } from "../types";
import "./index.scss";

interface ChattingStateProps {
  messages: ChatMessage[];
  /** AI 正在生成回复：消息列表末尾显示"正在输入"气泡 */
  thinking?: boolean;
}

const ChattingState = ({ messages, thinking = false }: ChattingStateProps) => {
  const lastId = messages.length ? messages[messages.length - 1].id : "";

  // 离开页面停止语音
  useUnload(() => stopCurrentVoice());

  return (
    <View className="chatting-state">
      <ScrollView
        scrollY
        className="chatting-state__list"
        scrollIntoView={lastId}
        scrollWithAnimation
      >
        <View className="chatting-state__content">
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} userAvatar="" />
          ))}
          {thinking && (
            <View className="chatting-state__row chatting-state__row--assistant">
              <View className="chatting-state__bubble chatting-state__bubble--assistant chatting-state__bubble--typing">
                <Text className="chatting-state__dot">•</Text>
                <Text className="chatting-state__dot">•</Text>
                <Text className="chatting-state__dot">•</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default ChattingState;
