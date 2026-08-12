import { useState } from "react";
import { View, Text } from "@tarojs/components";
import IdleState from "@/components/Learn/IdleState";
import ThinkingState from "@/components/Learn/ThinkingState";
import ChattingState from "@/components/Learn/ChattingState";
import ChatInput from "@/components/ChatInput";
import CustomTabBar from "@/components/CustomTabBar";
import { fetchDeepSeekReply } from "@/api/deepseek";
import type { ChatMessage } from "@/components/Learn/types";
import type { ChatState } from "@/types";
import "./index.scss";

const QUICK_PROMPTS = ["帮我出个谜题", "什么是魔法指令？", "教我写一个小游戏"];

let idSeed = 0;
const nextId = () => String(++idSeed);

const Learn = () => {
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");

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
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: reply },
      ]);
      setChatState("chatting");
    } catch {
      // API 内部已 Toast 提示，这里恢复为上一个稳定状态
      setChatState(history.length > 0 ? "chatting" : "idle");
    }
  };

  return (
    <View className="learn">
      <View className="learn__header">
        <Text className="learn__title">AI 学习助手</Text>
        <Text className="learn__subtitle">桥智同学在线为你服务 ✨</Text>
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
