import { useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import IdleState from "@/components/Learn/IdleState";
import ThinkingState from "@/components/Learn/ThinkingState";
import ChattingState from "@/components/Learn/ChattingState";
import ChatInput from "@/components/ChatInput";
import CustomTabBar from "@/components/CustomTabBar";
import { fetchDeepSeekReply } from "@/api/deepseek";
import { buildTitle, saveChatSession } from "@/api/history";
import type { ChatMessage } from "@/components/Learn/types";
import type { ChatState } from "@/types";
import "./index.scss";

const QUICK_PROMPTS = ["帮我出个谜题", "什么是魔法指令？", "教我写一个小游戏"];

let idSeed = 0;
const nextId = () => `msg-${++idSeed}`;

const Learn = () => {
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const sessionIdRef = useRef(`session-${Date.now()}`);

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
      // API 内部已 Toast 提示，这里恢复为上一个稳定状态
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
          <View className="learn__history-btn" onClick={goHistory}>
            📜 历史
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
      />

      <CustomTabBar currentTab="learn" />
    </View>
  );
};

export default Learn;
