import { useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, useLoad, useRouter } from "@tarojs/taro";
import IdleState from "@/components/Learn/IdleState";
import ThinkingState from "@/components/Learn/ThinkingState";
import ChattingState from "@/components/Learn/ChattingState";
import ChatInput from "@/components/ChatInput";
import CustomTabBar from "@/components/CustomTabBar";
import { fetchDeepSeekReply } from "@/api/deepseek";
import {
  buildTitle,
  getChatSession,
  getChatSessions,
  saveChatSession,
} from "@/api/history";
import type { ChatMessage } from "@/components/Learn/types";
import type { ChatState } from "@/types";
import "./index.scss";

const QUICK_PROMPTS = ["帮我出个谜题", "什么是魔法指令？", "教我写一个小游戏"];
const BLANK_FLAG = "learn_blank_session";

let idSeed = 0;
const nextId = () => `msg-${Date.now()}-${++idSeed}`;

const Learn = () => {
  const router = useRouter();
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const sessionIdRef = useRef(`session-${Date.now()}`);

  // 进入方式：
  // 1. ?new=1  -> 开启空白新对话
  // 2. ?sessionId=xxx -> 从历史页"继续对话"加载指定会话
  // 3. 无参数且上次为空白会话 -> 保持空白，不恢复历史
  // 4. 无参数且上次有真实对话 -> 恢复最近一次会话
  useLoad(() => {
    if (router.params.new === "1") {
      sessionIdRef.current = `session-${Date.now()}`;
      return;
    }

    const sessionId = router.params.sessionId;
    if (sessionId) {
      const target = getChatSession(sessionId);
      if (target && target.messages.length > 0) {
        sessionIdRef.current = target.id;
        setMessages(target.messages);
        setChatState("chatting");
      }
      return;
    }

    // 无参数：仅当上次退出前已有真实对话内容时才恢复最近会话
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
  });

  // 退出/切换页面时记录本次会话是否有真实内容
  useDidHide(() => {
    const sessionExists = !!getChatSession(sessionIdRef.current);
    const hasContent = messages.length > 0;
    Taro.setStorageSync(BLANK_FLAG, !sessionExists || !hasContent);
  });

  // 页面重新显示时（从历史页返回），若当前会话已被删除则重置为空白新对话
  const resetToBlank = () => {
    sessionIdRef.current = `session-${Date.now()}`;
    setMessages([]);
    setChatState("idle");
  };

  const startNewChat = () => {
    if (messages.length > 0) {
      persist(messages);
    }
    resetToBlank();
    Taro.showToast({ title: "已开启新对话 ✨", icon: "none" });
  };

  useDidShow(() => {
    const current = getChatSession(sessionIdRef.current);
    if (!current && messages.length > 0) {
      resetToBlank();
    }
  });

  const toggleRecord = () => {
    // ponytail: 语音识别插件暂未接入，点击给出提示
    Taro.showToast({ title: "语音功能暂未开通，先用文字输入吧", icon: "none" });
  };

  const persist = (list: ChatMessage[]) => {
    saveChatSession({
      id: sessionIdRef.current,
      title: buildTitle(list),
      messages: list,
      updatedAt: Date.now(),
    });
  };

  const send = async (text = inputText) => {
    const content = text.trim();
    if (!content || chatState === "thinking") return;

    const history: ChatMessage[] = [
      ...messages,
      { id: nextId(), role: "user", content },
    ];
    setMessages(history);
    setInputText("");
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
    } catch {
      // API 层已 Toast 提示错误原因，这里恢复状态让用户能继续输入
      setChatState(history.length > 0 ? "chatting" : "idle");
    }
  };

  const goHistory = () => {
    Taro.navigateTo({ url: "/pages/history/index" });
  };

  return (
    <View className="learn">
      <View className="learn__header">
        <View className="learn__header-row">
          <View className="learn__header-actions">
            <View className="btn-new-chat" onClick={startNewChat}>
              ＋ 新对话
            </View>
            <View className="learn__history-btn" onClick={goHistory}>
              📜 历史
            </View>
          </View>
          <View className="learn__header-text">
            <Text className="learn__title">AI 学习助手</Text>
            <Text className="learn__subtitle">桥智同学在线为你服务 ✨</Text>
          </View>
        </View>
      </View>

      <View className="learn__body">
        {chatState === "idle" && (
          <IdleState prompts={QUICK_PROMPTS} onPrompt={send} />
        )}
        {chatState === "thinking" && <ThinkingState />}
        {chatState === "chatting" && <ChattingState messages={messages} />}
      </View>

      <ChatInput
        value={inputText}
        onChange={setInputText}
        onSend={() => send()}
        isRecording={false}
        onMicTap={toggleRecord}
      />

      <CustomTabBar currentTab="learn" />
    </View>
  );
};

export default Learn;
