import { View, Text, Image, ScrollView } from "@tarojs/components";
import { useUnload } from "@tarojs/taro";
import { useEffect, useState } from "react";
import thinkingImg from "@/assets/images/思考.jpg";
import { getOrInitUserAccount } from "@/api/user";
import { stopCurrentVoice } from "@/utils/tts";
import MessageRow from "./MessageRow";
import type { ChatMessage } from "../types";
import "./index.scss";

interface ChattingStateProps {
  messages: ChatMessage[];
  /** AI 正在生成回复：消息列表末尾显示"正在输入"气泡（头像换思考态） */
  thinking?: boolean;
}

const ChattingState = ({ messages, thinking = false }: ChattingStateProps) => {
  const lastId = messages.length ? messages[messages.length - 1].id : "";
  const [userAvatar, setUserAvatar] = useState("");

  // 与「我的」页同源：读取用户档案头像（云端优先，本地缓存兜底）
  useEffect(() => {
    let alive = true;
    getOrInitUserAccount()
      .then((account) => {
        if (alive) setUserAvatar(account.profile.avatarUrl || "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

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
            <MessageRow key={m.id} message={m} userAvatar={userAvatar} />
          ))}
          {thinking && (
            <View className="chatting-state__row chatting-state__row--assistant">
              <Image
                className="chatting-state__face chatting-state__face--thinking"
                src={thinkingImg}
                mode="aspectFit"
              />
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
