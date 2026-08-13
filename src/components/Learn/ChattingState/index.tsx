import { View, Text, Image, ScrollView } from "@tarojs/components";
import mascotImg from "../../../../assets/images/桥智同学.jpg";
import type { ChatMessage } from "../types";
import "./index.scss";

interface ChattingStateProps {
  messages: ChatMessage[];
}

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
              <Text>{m.content}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default ChattingState;
