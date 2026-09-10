import { useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidHide, useLoad, useRouter } from "@tarojs/taro";
import IdleState from "@/components/Learn/IdleState";
import ThinkingState from "@/components/Learn/ThinkingState";
import ChattingState from "@/components/Learn/ChattingState";
import ChatInput from "@/components/ChatInput";
import MediaPanel from "@/components/Learn/MediaPanel";
import CustomTabBar from "@/components/CustomTabBar";
import { useRecorder } from "@/hooks/useRecorder";
import { useChatSession } from "@/hooks/useChatSession";
import type { AwardChatResult } from "@/types";
import "./index.scss";

const QUICK_PROMPTS = ["帮我出个谜题", "什么是魔法指令？", "教我写一个小游戏"];

const Learn = () => {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [awardTip, setAwardTip] = useState<AwardChatResult | null>(null);
  const awardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 对话成功后激励反馈：积分飘字 + 升级/解锁勋章提示
  const showAward = (award: AwardChatResult | null) => {
    if (!award) return;
    setAwardTip(award);
    if (awardTimerRef.current) clearTimeout(awardTimerRef.current);
    awardTimerRef.current = setTimeout(() => setAwardTip(null), 1800);
    if (award.isLevelUp) {
      Taro.showToast({
        title: `🎉 恭喜晋升为 Lv.${award.newLevel} 灵感发现者！`,
        icon: "none",
      });
    }
    if (award.newlyUnlockedBadges.length > 0) {
      Taro.showToast({
        title: "🏅 解锁新勋章，去「我的」看看吧！",
        icon: "none",
      });
    }
  };

  const {
    chatState,
    messages,
    send,
    sendMedia,
    startNewChat,
    restore,
    flagHiding,
  } = useChatSession(showAward);
  const {
    init: initRecorder,
    toggle: toggleRecord,
    isRecording,
    stopIfRecording,
  } = useRecorder(setInputText);

  // 进入：初始化语音后按路由参数恢复会话（new=1 空白 / historyId 云端恢复 /
  // sessionId 本地会话 / 空白标记不恢复 / 最近会话）
  useLoad(() => {
    try {
      initRecorder();
    } catch {
      Taro.showToast({
        title: "语音识别未开通，请先在后台添加插件",
        icon: "none",
      });
    }
    restore(router.params);
  });

  // 退出/切换页面：记录本次会话空白标记，并停止录音
  useDidHide(() => {
    flagHiding();
    stopIfRecording();
  });

  const handleSend = (text = inputText) => {
    if (!text.trim()) return;
    setInputText("");
    send(text);
  };

  // 媒体上传成功：关闭面板并发送图片消息（AI 自动回复引导文案）
  const handleMediaUploaded = (fileID: string) => {
    setMediaOpen(false);
    sendMedia(fileID);
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
            <Text className="learn__subtitle">桥智同学与你共同成长探索</Text>
          </View>
        </View>
      </View>

      <View className="learn__body">
        {chatState === "idle" && (
          <IdleState prompts={QUICK_PROMPTS} onPrompt={handleSend} />
        )}
        {chatState === "thinking" && <ThinkingState />}
        {chatState === "chatting" && <ChattingState messages={messages} />}
      </View>

      {awardTip && (
        <View className="learn__award">
          <Text className="learn__award-text">
            积分 +{awardTip.pointsGained} 🌟
          </Text>
        </View>
      )}

      <ChatInput
        value={inputText}
        onChange={setInputText}
        onSend={() => handleSend()}
        isRecording={isRecording}
        onMicTap={toggleRecord}
        onPlusTap={() => setMediaOpen(true)}
      />

      <MediaPanel
        visible={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onUploaded={handleMediaUploaded}
      />

      <CustomTabBar currentTab="learn" />
    </View>
  );
};

export default Learn;
