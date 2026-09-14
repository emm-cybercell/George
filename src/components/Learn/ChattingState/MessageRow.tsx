import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useState } from "react";
import mascotImg from "@/assets/images/立绘2.jpg";
import { getVoiceState, onVoiceChange, toggleTextVoice } from "@/utils/tts";
import type { VoiceStatus } from "@/utils/tts";
import { updateChatFeedback } from "@/api/cloudChat";
import { saveCreativeWork } from "@/api/works";
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

/** 反馈行：工具标签 + 参考条数 + 👍/👎（仅 AI 文本消息显示） */
const FeedbackRow = ({ message: m }: { message: ChatMessage }) => {
  const [liked, setLiked] = useState<boolean | null>(m.liked ?? null);
  const hasFeedback = !!m.cloudRecordId && !!m.content;
  if (!hasFeedback && !(m.toolLabels || []).length && !m.knowledgeHits)
    return null;

  const send = (value: boolean) => {
    setLiked(value);
    if (m.cloudRecordId) updateChatFeedback(m.cloudRecordId, value);
  };

  return (
    <View className="chatting-state__feedback">
      {(m.toolLabels || []).slice(0, 3).map((label) => (
        <Text key={label} className="chatting-state__fb-tag">
          {label}
        </Text>
      ))}
      {m.knowledgeHits ? (
        <Text className="chatting-state__fb-kb">参考 {m.knowledgeHits} 条</Text>
      ) : null}
      {hasFeedback && (
        <View className="chatting-state__fb-actions">
          <Text
            className={`chatting-state__fb-btn ${liked === true ? "chatting-state__fb-btn--on" : ""}`}
            onClick={() => liked === null && send(true)}
          >
            👍
          </Text>
          <Text
            className={`chatting-state__fb-btn ${liked === false ? "chatting-state__fb-btn--down" : ""}`}
            onClick={() => liked === null && send(false)}
          >
            👎
          </Text>
        </View>
      )}
    </View>
  );
};

/** AI 图片收藏：一键存入作品集 */
const CollectBtn = ({ message: m }: { message: ChatMessage }) => {
  const [saved, setSaved] = useState(false);
  if (!m.mediaUrl || isCloudFile(m.mediaUrl) === false) return null;
  if (saved) return <Text className="chatting-state__fb-kb">已存入作品集 ⭐</Text>;

  const save = async () => {
    try {
      await saveCreativeWork({
        title: (m.prompt || "AI 生图作品").slice(0, 12),
        category: "drawing",
        mediaType: "image",
        mediaUrl: m.mediaUrl as string,
        content: m.prompt || "",
        abilityMode: "",
      });
      setSaved(true);
      Taro.showToast({ title: "已存入作品集 ⭐", icon: "none" });
    } catch {
      Taro.showToast({ title: "收藏失败，请重试", icon: "none" });
    }
  };

  return (
    <Text className="chatting-state__fb-btn" onClick={save}>
      ⭐ 收藏
    </Text>
  );
};

/** cloud:// 开头才是云存储作品图；AI 生图 https 链接也可收藏 */
function isCloudFile(url: string): boolean {
  return url.startsWith("cloud://") || url.startsWith("https://");
}

interface MessageRowProps {
  message: ChatMessage;
  /** 用户头像 URL（cloud fileID 或 https），空则渲染默认占位 */
  userAvatar: string;
}

/** 微信式消息行：各自头像 + 气泡（助手在左、用户在右） */
const MessageRow = ({ message: m, userAvatar }: MessageRowProps) => {
  const isUser = m.role === "user";

  const assistantFace = <Image className="chatting-state__face" src={mascotImg} mode="aspectFit" />;
  const userFace = userAvatar ? (
    <Image className="chatting-state__face" src={userAvatar} mode="aspectFit" />
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
      <View className="chatting-state__col">
        {bubble}
        {!isUser && m.mediaUrl && <CollectBtn message={m} />}
        {!isUser && !m.mediaUrl && <FeedbackRow message={m} />}
      </View>
      {!isUser && m.content && <VoiceBtn msgId={m.id} text={m.content} />}
      {isUser && userFace}
    </View>
  );
};

export default MessageRow;
