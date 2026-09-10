import { View, Text, Image, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import mascotImg from "@/assets/images/立绘2.jpg";
import type { ChatMessage } from "../types";
import "./index.scss";

interface ChattingStateProps {
  messages: ChatMessage[];
}

/** 图片消息气泡：点击放大预览 */
const renderBubbleContent = (m: ChatMessage) => {
  if (m.mediaUrl) {
    return (
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
    );
  }
  return <Text>{m.content}</Text>;
};

const ChattingState = ({ messages }: ChattingStateProps) => {
  const lastId = messages.length ? messages[messages.length - 1].id : "";

  return (
    <View className="chatting-state">
      <Image
        className="chatting-state__avatar"
        src={mascotImg}
        mode="aspectFit"
      />
      <ScrollView
        scrollY
        className="chatting-state__list"
        scrollIntoView={lastId}
        scrollWithAnimation
      >
        <View className="chatting-state__content">
          {messages.map((m) => (
            <View
              key={m.id}
              id={m.id}
              className={`chatting-state__row ${
                m.role === "user"
                  ? "chatting-state__row--user"
                  : "chatting-state__row--assistant"
              }`}
            >
              <View
                className={`chatting-state__bubble ${
                  m.role === "user"
                    ? "chatting-state__bubble--user"
                    : "chatting-state__bubble--assistant"
                }`}
              >
                {renderBubbleContent(m)}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default ChattingState;
