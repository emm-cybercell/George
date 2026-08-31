import { useEffect, useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import {
  clearChatSessions,
  deleteChatSession,
  getChatSessions,
  type ChatSession,
} from "@/api/history";
import {
  clearCloudChatRecords,
  deleteCloudChatRecord,
  queryCloudChatRecords,
  type CloudChatRecord,
} from "@/api/cloud";
import type { ChatMessage } from "@/components/Learn/types";
import "./index.scss";

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 云端记录标题：取问题截断 */
const titleOf = (q: string) => (q.length > 12 ? `${q.slice(0, 12)}…` : q);

const History = () => {
  const [cloudRecords, setCloudRecords] = useState<CloudChatRecord[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [useCloud, setUseCloud] = useState(false);

  const refresh = async () => {
    // 云优先：云端有记录则渲染云端真实对话
    const cloud = await queryCloudChatRecords();
    if (cloud.length > 0) {
      setCloudRecords(cloud);
      setSessions([]);
      setUseCloud(true);
      return;
    }
    // 云端不可用/无记录：降级本地会话
    setCloudRecords([]);
    setSessions(getChatSessions());
    setUseCloud(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const goBack = () => {
    Taro.navigateBack();
  };

  const toggle = (id: string) => {
    setActiveId((prev) => (prev === id ? "" : id));
  };

  const onDelete = async (id: string) => {
    deleteChatSession(id);
    if (useCloud) {
      await deleteCloudChatRecord(id);
    }
    if (activeId === id) setActiveId("");
    refresh();
  };

  const onContinue = (id: string) => {
    Taro.redirectTo({ url: `/pages/learn/index?sessionId=${id}` });
  };

  const onClearAll = () => {
    Taro.showModal({
      title: "清空历史",
      content: "确定删除全部历史对话吗？此操作不可恢复。",
      confirmColor: "#8B5CF6",
      success: async (res) => {
        if (res.confirm) {
          clearChatSessions();
          if (useCloud) {
            await clearCloudChatRecords();
          }
          setActiveId("");
          refresh();
        }
      },
    });
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

  const renderCloudDetail = (r: CloudChatRecord) => (
    <View className="history-detail">
      <View className="history-detail__row history-detail__row--user">
        <View className="history-detail__bubble history-detail__bubble--user">
          <Text>{r.userQuery}</Text>
        </View>
      </View>
      <View className="history-detail__row history-detail__row--ai">
        <View className="history-detail__bubble history-detail__bubble--ai">
          <Text>{r.aiReply}</Text>
        </View>
      </View>
      <View className="history-detail__actions">
        <View
          className="history-detail__delete"
          onClick={() => onDelete(r._id as string)}
        >
          🗑 删除该对话
        </View>
      </View>
    </View>
  );

  const isEmpty = useCloud ? cloudRecords.length === 0 : sessions.length === 0;

  return (
    <View className="history">
      <View className="history__header">
        <View className="history__header-row">
          <View className="history__left-group">
            <View className="history__back" onClick={goBack}>
              ‹ 返回
            </View>
            <View
              className={`history__clear ${isEmpty ? "history__clear--disabled" : ""}`}
              onClick={onClearAll}
            >
              🗑 清空
            </View>
          </View>
          <Text className="history__title">历史对话</Text>
        </View>
      </View>

      <ScrollView scrollY className="history__list">
        <View className="history__content">
          {isEmpty && (
            <Text className="history__empty">
              还没有对话记录，去学习页聊聊吧 ✨
            </Text>
          )}

          {useCloud
            ? cloudRecords.map((r) => (
                <View key={r._id} className="history__session">
                  <View
                    className="history__row"
                    onClick={() => toggle(r._id as string)}
                  >
                    <View className="history__info">
                      <Text className="history__label">
                        {titleOf(r.userQuery)}
                      </Text>
                      <Text className="history__time">
                        {formatTime(r.createTime)}
                      </Text>
                    </View>
                    <Text className="history__arrow">
                      {activeId === r._id ? "▾" : "›"}
                    </Text>
                  </View>
                  {activeId === r._id && renderCloudDetail(r)}
                </View>
              ))
            : sessions.map((s) => (
                <View key={s.id} className="history__session">
                  <View className="history__row" onClick={() => toggle(s.id)}>
                    <View className="history__info">
                      <Text className="history__label">{s.title}</Text>
                      <Text className="history__time">
                        {formatTime(s.updatedAt)}
                      </Text>
                    </View>
                    <View
                      className="history__continue-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onContinue(s.id);
                      }}
                    >
                      💬 继续
                    </View>
                    <Text className="history__arrow">
                      {activeId === s.id ? "▾" : "›"}
                    </Text>
                  </View>

                  {activeId === s.id && (
                    <View className="history-detail">
                      {renderMessages(s.messages)}
                      <View className="history-detail__actions">
                        <View
                          className="history-detail__delete"
                          onClick={() => onDelete(s.id)}
                        >
                          🗑 删除该对话
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default History;
