import { useRef, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { fetchDeepSeekReply } from "@/api/deepseek";
import { getCloudChatRecord, saveChatRecordToCloud } from "@/api/cloudChat";
import { awardChatPoints } from "@/api/user";
import { ABILITY_STORAGE_KEY, DEFAULT_ABILITY_ID } from "@/types/ability";
import {
  buildTitle,
  getChatSession,
  getChatSessions,
  saveChatSession,
} from "@/api/history";
import type { ChatMessage } from "@/components/Learn/types";
import type { AwardChatResult, ChatState } from "@/types";

const BLANK_FLAG = "learn_blank_session";
/** 图片上传后的固定引导回复 */
export const IMAGE_GUIDE_REPLY =
  "哇！我收到你的作品啦！快告诉我，这幅作品背后藏着什么样有趣的创意思路？✨";
let idSeed = 0;
const nextId = () => `msg-${Date.now()}-${++idSeed}`;

/** 学习页路由参数（用于会话恢复判定） */
export interface LearnRouteParams {
  new?: string;
  historyId?: string;
  sessionId?: string;
  /** 首页灵感直达：携带问题直接发起提问 */
  prompt?: string;
}
/** 学习页会话状态机：三状态、本地备份、云端写入、按路由参数恢复会话 */
export function useChatSession(
  onDidReply?: (award: AwardChatResult | null) => void,
) {
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sessionIdRef = useRef(`session-${Date.now()}`);

  const persist = (list: ChatMessage[]) => {
    saveChatSession({
      id: sessionIdRef.current,
      title: buildTitle(list),
      messages: list,
      updatedAt: Date.now(),
    });
  };

  const resetToBlank = () => {
    sessionIdRef.current = `session-${Date.now()}`;
    setMessages([]);
    setChatState("idle");
  };

  const startNewChat = () => {
    if (messages.length > 0) persist(messages);
    resetToBlank();
    Taro.showToast({ title: "已开启新对话 ✨", icon: "none" });
  };
  const restoreFromHistory = (historyId: string) => {
    getCloudChatRecord(historyId)
      .then((record) => {
        if (record?.userQuery && record.aiReply) {
          sessionIdRef.current = `session-${historyId}`;
          setMessages([
            { id: nextId(), role: "user", content: record.userQuery },
            { id: nextId(), role: "assistant", content: record.aiReply },
          ]);
          setChatState("chatting");
          return;
        }
        const local = getChatSession(historyId);
        if (local && local.messages.length > 0) {
          sessionIdRef.current = local.id;
          setMessages(local.messages);
          setChatState("chatting");
        }
      })
      .catch((err) => console.warn("历史会话恢复失败:", err));
  };

  /** 恢复会话：优先级 new=1 > prompt 直达 > historyId > sessionId > 空白标记不恢复 > 最近会话 */
  const restore = (params: LearnRouteParams) => {
    if (params.new === "1") {
      sessionIdRef.current = `session-${Date.now()}`;
      return;
    }
    if (params.prompt) {
      // 首页灵感直达：开新会话并直接发起提问
      const text = decodeURIComponent(params.prompt);
      if (text.trim()) {
        sessionIdRef.current = `session-${Date.now()}`;
        send(text);
        return;
      }
    }
    if (params.historyId) {
      restoreFromHistory(params.historyId);
      return;
    }
    if (params.sessionId) {
      const target = getChatSession(params.sessionId);
      if (target && target.messages.length > 0) {
        sessionIdRef.current = target.id;
        setMessages(target.messages);
        setChatState("chatting");
      }
      return;
    }
    if (Taro.getStorageSync(BLANK_FLAG)) {
      Taro.removeStorageSync(BLANK_FLAG);
      return;
    }
    const latest = getChatSessions()[0];
    if (latest && latest.messages.length > 0) {
      sessionIdRef.current = latest.id;
      setMessages(latest.messages);
      setChatState("chatting");
    }
  };

  // 页面重新显示时，若当前会话已被删除则重置为空白新对话
  useDidShow(() => {
    const current = getChatSession(sessionIdRef.current);
    if (!current && messages.length > 0) resetToBlank();
  });
  /** 发送提问：写入消息流、请求 AI、双份持久化（本地 + 云端） */
  const send = async (text: string) => {
    const content = text.trim();
    if (!content || chatState === "thinking") return;

    const history: ChatMessage[] = [
      ...messages,
      { id: nextId(), role: "user", content },
    ];
    setMessages(history);
    setChatState("thinking");

    try {
      const reply = await fetchDeepSeekReply(
        history.map(({ role, content: c }) => ({ role, content: c })),
      );
      const withReply: ChatMessage[] = [
        ...history,
        { id: nextId(), role: "assistant", content: reply },
      ];
      setMessages(withReply);
      setChatState("chatting");
      persist(withReply);
      // 同步写入云端聊天记录（失败静默，本地已持久化备份）
      saveChatRecordToCloud({
        userQuery: content,
        aiReply: reply,
        abilityMode:
          Taro.getStorageSync(ABILITY_STORAGE_KEY) || DEFAULT_ABILITY_ID,
      });
      // 激励联动：发积分、算等级、解锁勋章（失败静默，不影响对话）
      onDidReply?.(await awardChatPoints());
    } catch {
      // API 层已 Toast 提示错误原因，这里恢复状态让用户能继续输入
      setChatState(history.length > 0 ? "chatting" : "idle");
    }
  };

  /** 页面隐藏时记录本次会话是否为空白，供下次进入判定是否恢复 */
  const flagHiding = () => {
    const hasContent = messages.length > 0;
    Taro.setStorageSync(
      BLANK_FLAG,
      !getChatSession(sessionIdRef.current) || !hasContent,
    );
  };

  /** 发送图片消息：插消息流 + AI 引导回复 + 双份持久化 */
  const sendMedia = (fileID: string) => {
    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        id: nextId(),
        role: "user",
        content: "📷 上传了一张作品",
        mediaUrl: fileID,
      },
      { id: nextId(), role: "assistant", content: IMAGE_GUIDE_REPLY },
    ];
    setMessages(nextMessages);
    setChatState("chatting");
    persist(nextMessages);
    saveChatRecordToCloud({
      userQuery: "📷 上传作品",
      aiReply: IMAGE_GUIDE_REPLY,
      abilityMode:
        Taro.getStorageSync(ABILITY_STORAGE_KEY) || DEFAULT_ABILITY_ID,
    });
  };

  return {
    chatState,
    messages,
    send,
    sendMedia,
    startNewChat,
    restore,
    flagHiding,
  };
}
