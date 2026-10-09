import { useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import {
  clearChatSessions,
  deleteChatSession,
  getChatSessions,
  type ChatSession,
} from "@/api/chat";
import {
  clearCloudChatRecords,
  type CloudChatRecord,
} from "@/api/chat";
import {
  deleteCloudSessionRecords,
  queryCloudSessions,
  type CloudChatSession,
} from "@/api/chat";
import { getLatestDigest, type LearningDigest } from "@/api/knowledge";
import HistoryCard, { formatTime, titleOf } from "@/components/HistoryCard";
import "./index.scss";

const History = () => {
  const [cloudSessions, setCloudSessions] = useState<CloudChatSession[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [useCloud, setUseCloud] = useState(false);
  const [loading, setLoading] = useState(true);
  const [digest, setDigest] = useState<LearningDigest | null>(null);

  // 页面展示时云优先拉取真实记录（按会话聚合多轮），云端无记录降级本地会话
  const refresh = async () => {
    setLoading(true);
    const cloud = await queryCloudSessions();
    if (cloud.length > 0) {
      setCloudSessions(cloud);
      setSessions([]);
      setUseCloud(true);
    } else {
      setCloudSessions([]);
      setSessions(getChatSessions());
      setUseCloud(false);
    }
    setLoading(false);
  };

  useDidShow(() => {
    refresh();
    getLatestDigest().then(setDigest);
  });

  const goBack = () => Taro.navigateBack();

  const toggle = (id: string) => setActiveId((prev) => (prev === id ? "" : id));

  const onDelete = async (target: ChatSession | CloudChatSession) => {
    deleteChatSession(target.id);
    if (useCloud) {
      await deleteCloudSessionRecords((target as CloudChatSession).records);
    }
    if (activeId === target.id) setActiveId("");
    refresh();
  };

  // 打开对话：携带 historyId 跳转学习页恢复（云端记录直读，本地会话降级复用）
  const onOpen = (id: string) => {
    Taro.redirectTo({ url: `/pages/learn/index?historyId=${id}` });
  };

  // 本地会话快速续聊
  const onContinue = (id: string) => {
    Taro.redirectTo({ url: `/pages/learn/index?sessionId=${id}` });
  };

  const onClearAll = () => {
    Taro.showModal({
      title: "清空历史",
      content: "确定要清空所有历史对话吗？",
      confirmColor: "#8B5CF6",
      success: async (res) => {
        if (!res.confirm) return;
        clearChatSessions();
        if (useCloud) await clearCloudChatRecords();
        setActiveId("");
        setSessions([]);
        setCloudSessions([]);
        setUseCloud(false);
        Taro.showToast({ title: "已清空", icon: "success" });
      },
    });
  };

  const isEmpty = cloudSessions.length === 0 && sessions.length === 0;
  // 整段会话展开为按时间升序的多轮气泡行
  const rowsOf = (s: CloudChatSession) =>
    s.records.flatMap((r: CloudChatRecord) => [
      { role: "user" as const, content: r.userQuery },
      { role: "assistant" as const, content: r.aiReply },
    ]);
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
          {digest && (
            <View className="history__digest">
              <Text className="history__digest-title">🌱 最近学习小结</Text>
              <Text className="history__digest-text">{digest.summary}</Text>
              {digest.topics.length > 0 && (
                <View className="history__digest-tags">
                  {digest.topics.map((t) => (
                    <Text key={t} className="history__digest-tag">
                      #{t}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
          {loading ? (
            <View className="history__skeleton">
              {[0, 1, 2].map((i) => (
                <View key={i} className="history__skeleton-card" />
              ))}
            </View>
          ) : isEmpty ? (
            <Text className="history__empty">
              还没有对话记录，去学习页聊聊吧 ✨
            </Text>
          ) : useCloud ? (
            cloudSessions.map((s) => (
              <HistoryCard
                key={s.id}
                title={titleOf(s.title)}
                timeText={formatTime(s.updatedAt)}
                rows={rowsOf(s)}
                showContinue={false}
                expanded={activeId === s.id}
                onOpen={() => onOpen(s.id)}
                onToggle={() => toggle(s.id)}
                onDelete={() => onDelete(s)}
              />
            ))
          ) : (
            sessions.map((s) => (
              <HistoryCard
                key={s.id}
                title={s.title}
                timeText={formatTime(s.updatedAt)}
                rows={s.messages.map((m) => ({
                  role: m.role,
                  content: m.content,
                }))}
                showContinue
                expanded={activeId === s.id}
                onOpen={() => onOpen(s.id)}
                onToggle={() => toggle(s.id)}
                onContinue={() => onContinue(s.id)}
                onDelete={() => onDelete(s)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default History;
