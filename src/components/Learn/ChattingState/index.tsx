import { View, Text, Image, ScrollView } from "@tarojs/components";
import mascotImg from "../../../../assets/桥智同学.jpg";
import type { ChatMessage } from "../types";
import "./index.scss";

interface ChattingStateProps {
  messages: ChatMessage[];
}

const ChattingState = ({ messages }: ChattingStateProps) => {
  return (
    <View className="chatting-state">
      <Image
        className="chatting-state__avatar"
        src={mascotImg}
        mode="aspectFit"
      />
      <ScrollView scrollY className="chatting-state__list">
        {messages.map((m) => (
          <View
            key={m.id}
            className={`chatting-state__bubble ${
              m.role === "user"
                ? "chatting-state__bubble--user"
                : "chatting-state__bubble--assistant"
            }`}
          >
            <Text>{m.content}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default ChattingState;
