import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useState } from "react";
import mascotImg from "@/assets/images/立绘2.jpg";
import {
  getVoiceState,
  onVoiceChange,
  toggleTextVoice,
} from "@/utils/tts";
import type { VoiceStatus } from "@/utils/tts";
import type { ChatMessage } from "../types";

/** 单个语音按钮：随全局语音状态实时刷新图标 */
const VoiceBtn = ({ msgId, text }: { msgId: string; text: string }) => {
  const [voice, setVoice] = useState<{
    token: string | null;
    status: VoiceStatus;
  }>(getVoiceState());

  useEffect(() => onVoiceChange(() => setVoice(getVoiceState())), []);

  const isThis = voice.token === msgId;
  const playing = isThis && voice.status === "playing";
  const loading = isThis && voice.status === "loading";
  const icon = loading ? "⏳" : playing ? "⏸" : "▶️";

  return (
    <Text
      className={`chatting-state__speaker ${
        playing ? "chatting-state__speaker--on" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        toggleTextVoice(text, msgId, true);
      }}
    >
      {icon}
    </Text>
  );
};

interface MessageRowProps {
  message: ChatMessage;
  /** 用户头像 URL（cloud fileID 或 https），空则渲染默认头像 */
  userAvatar: string;
}

/** 微信式消息行：各自头像 + 气泡（助手在左、用户在右） */
const MessageRow = ({ message: m, userAvatar }: MessageRowProps) => {
  const isUser = m.role === "user";

  const assistantFace = (
    <Image
      className="chatting-state__face"
      src={mascotImg}
      mode="aspectFill"
    />
  );
  const userFace = userAvatar ? (
    <Image className="chatting-state__face" src={userAvatar} mode="aspectFill" />
  ) : (
    <View className="chatting-state__face chatting-state__face--fallback">
      <Text className="chatting-state__face-text">我</Text>
    </View>
  );

  const bubble = (
    <View
      className={`chatting-state__bubble ${
        isUser
          ? "chatting-state__bubble--user"
          : "chatting-state__bubble--assistant"
      }`}
    >
      {m.mediaUrl ? (
        <Image
          className="chatting-state__media"
          src={m.mediaUrl}
          mode="aspectFill"
          onClick={() =>
            Taro.previewImage({
              urls: [m.mediaUrl as string],
              current: m.mediaUrl as string,
            })
          }
        />
      ) : (
        <Text>{m.content}</Text>
      )}
    </View>
  );

  return (
    <View
      className={`chatting-state__row ${
        isUser ? "chatting-state__row--user" : "chatting-state__row--assistant"
      }`}
    >
      {!isUser && assistantFace}
      {bubble}
      {!isUser && m.content && <VoiceBtn msgId={m.id} text={m.content} />}
      {isUser && userFace}
    </View>
  );
};

export default MessageRow;
