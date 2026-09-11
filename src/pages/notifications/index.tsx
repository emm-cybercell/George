import { useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { NOTICES, NOTICE_TABS } from "./data";
import type { NoticeType } from "./data";
import "./index.scss";

const READ_KEY = "notices_read";
const TYPE_META: Record<NoticeType, { icon: string; label: string }> = {
  achievement: { icon: "🏆", label: "成就提醒" },
  tip: { icon: "💡", label: "学习锦囊" },
  letter: { icon: "📬", label: "桥智来信" },
};

const Notifications = () => {
  const [tab, setTab] = useState<"all" | NoticeType>("all");
  const [readIds, setReadIds] = useState<string[]>(
    Taro.getStorageSync(READ_KEY) || [],
  );

  const list = NOTICES.filter((n) => tab === "all" || n.type === tab);
  const unreadCount = NOTICES.filter((n) => !readIds.includes(n.id)).length;

  const markRead = (id: string) => {
    if (readIds.includes(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    Taro.setStorageSync(READ_KEY, next);
  };

  const markAllRead = () => {
    const next = NOTICES.map((n) => n.id);
    setReadIds(next);
    Taro.setStorageSync(READ_KEY, next);
    Taro.showToast({ title: "已全部标记为已读", icon: "none" });
  };

  return (
    <View className="notifications">
      <View className="notifications__header">
        <View className="notifications__header-row">
          <View
            className="notifications__back"
            onClick={() => Taro.navigateBack()}
          >
            ‹ 返回
          </View>
          <Text className="notifications__title">消息通知</Text>
          <View className="notifications__mark-all" onClick={markAllRead}>
            全部已读
          </View>
        </View>
      </View>

      <View className="notifications__tabs">
        {NOTICE_TABS.map((t) => (
          <View
            key={t.key}
            className={`notifications__tab ${
              tab === t.key ? "notifications__tab--active" : ""
            }`}
            onClick={() => setTab(t.key)}
          >
            <Text>{t.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView scrollY className="notifications__list">
        <View className="notifications__content">
          {unreadCount > 0 && tab === "all" && (
            <Text className="notifications__summary">
              🔔 共 {unreadCount} 条未读消息
            </Text>
          )}
          {list.length === 0 ? (
            <Text className="notifications__empty">
              暂时没有新动态，去探索新知识吧 ✨
            </Text>
          ) : (
            list.map((n) => {
              const meta = TYPE_META[n.type];
              const unread = !readIds.includes(n.id);
              return (
                <View
                  key={n.id}
                  className={`notice-card ${
                    unread ? "notice-card--unread" : ""
                  }`}
                  onClick={() => markRead(n.id)}
                >
                  {unread && <View className="notice-card__dot" />}
                  <View className="notice-card__icon">{meta.icon}</View>
                  <View className="notice-card__body">
                    <View className="notice-card__title-row">
                      <Text className="notice-card__tag">{meta.label}</Text>
                      <Text className="notice-card__time">{n.time}</Text>
                    </View>
                    <Text className="notice-card__title">{n.title}</Text>
                    <Text className="notice-card__content">{n.content}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default Notifications;
