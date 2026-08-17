import Taro from "@tarojs/taro";
import type { ChatMessage } from "@/components/Learn/types";

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const STORAGE_KEY = "chat_history";

/** 取第一条用户消息做标题，截断为 12 字 */
export function buildTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "新对话";
  const text = first.content.trim();
  return text.length > 12 ? `${text.slice(0, 12)}…` : text;
}

export function getChatSessions(): ChatSession[] {
  const raw = Taro.getStorageSync(STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getChatSession(id: string): ChatSession | undefined {
  return getChatSessions().find((s) => s.id === id);
}

export function saveChatSession(session: ChatSession): void {
  const list = getChatSessions();
  const idx = list.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    list[idx] = session;
  } else {
    list.unshift(session);
  }
  Taro.setStorageSync(STORAGE_KEY, list);
}

export function deleteChatSession(id: string): void {
  const list = getChatSessions().filter((s) => s.id !== id);
  Taro.setStorageSync(STORAGE_KEY, list);
}

export function clearChatSessions(): void {
  Taro.removeStorageSync(STORAGE_KEY);
}
