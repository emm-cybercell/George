import { useEffect, useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { getChatSessions, type ChatSession } from "@/api/history";
import type { ChatMessage } from "@/components/Learn/types";
import "./index.scss";

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const History = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    setSessions(getChatSessions());
  }, []);

  const goBack = () => {
    Taro.navigateBack();
  };

  const toggle = (id: string) => {
    setActiveId((prev) => (prev === id ? "" : id));
  };

  const renderMessages = (list: ChatMessage[]) =>
    list.map((m) => (
      <View
        key={m.id}
        className={`history-detail__row ${
          m.role === "user"
            ? "history-detail__row--user"
            : "history-detail__row--ai"
        }`}
      >
        <View
          className={`history-detail__bubble ${
            m.role === "user"
              ? "history-detail__bubble--user"
              : "history-detail__bubble--ai"
          }`}
        >
          <Text>{m.content}</Text>
        </View>
      </View>
    ));

  return (
    <View className="history">
      <View className="history__header">
        <View className="history__header-row">
          <View className="history__back" onClick={goBack}>
            ‹ 返回
          </View>
          <Text className="history__title">历史对话</Text>
        </View>
      </View>

      <ScrollView scrollY className="history__list">
        {sessions.length === 0 && (
          <Text className="history__empty">
            还没有对话记录，去学习页聊聊吧 ✨
          </Text>
        )}

        {sessions.map((s) => (
          <View
            key={s.id}
            className="history__session"
            onClick={() => toggle(s.id)}
          >
            <View className="history__row">
              <View className="history__info">
                <Text className="history__label">{s.title}</Text>
                <Text className="history__time">{formatTime(s.updatedAt)}</Text>
              </View>
              <Text className="history__arrow">
                {activeId === s.id ? "▾" : "›"}
              </Text>
            </View>

            {activeId === s.id && (
              <View className="history-detail">
                {renderMessages(s.messages)}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default History;
