import { useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidHide, useLoad, useRouter } from "@tarojs/taro";
import IdleState from "@/components/Learn/IdleState";
import ThinkingState from "@/components/Learn/ThinkingState";
import ChattingState from "@/components/Learn/ChattingState";
import ChatInput from "@/components/ChatInput";
import MediaPanel from "@/components/Learn/MediaPanel";
import ImageGenPanel from "@/components/Learn/ImageGenPanel";
import MaterialPanel from "@/components/Learn/MaterialPanel";
import CustomTabBar from "@/components/CustomTabBar";
import { useRecorder } from "@/hooks/useRecorder";
import { useChatSession } from "@/hooks/useChatSession";
import { vibrateIfEnabled } from "@/utils/settings";
import { isWebSearchEnabled } from "@/components/ChatInput";
import type { AwardChatResult } from "@/types";
import "./index.scss";

const QUICK_PROMPTS = [
  "给我推荐一个挑战",
  "帮我出个谜题",
  "什么是魔法指令？",
];

const Learn = () => {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [imageGenOpen, setImageGenOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
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
    sendImage,
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

  // 进入：初始化语音后按路由参数恢复会话（new=1 空白 / prompt 预填充输入框 /
  // historyId 云端恢复 / sessionId 本地会话 / 空白标记不恢复 / 最近会话）
  useLoad(() => {
    try {
      initRecorder();
    } catch {
      Taro.showToast({
        title: "语音识别未开通，请先在后台添加插件",
        icon: "none",
      });
    }
    const pendingText = restore(router.params);
    if (pendingText) {
      setInputText(pendingText);
      Taro.showToast({ title: "已为你填好，点发送即可 ✨", icon: "none" });
    }
  });

  // 退出/切换页面：记录本次会话空白标记，并停止录音
  useDidHide(() => {
    flagHiding();
    stopIfRecording();
  });

  const handleSend = (text = inputText) => {
    if (!text.trim()) return;
    vibrateIfEnabled();
    setInputText("");
    send(text, isWebSearchEnabled());
  };

  // 媒体上传成功：关闭面板并发送图片消息（AI 自动回复引导文案）
  const handleMediaUploaded = (fileID: string) => {
    setMediaOpen(false);
    sendMedia(fileID);
  };

  // 生图成功：关闭面板并将生成图作为消息插入对话
  const handleImageGenerated = (imageUrl: string, promptText: string) => {
    setImageGenOpen(false);
    sendImage(imageUrl, promptText);
  };

  const goHistory = () => {
    Taro.navigateTo({ url: "/pages/history/index" });
  };

  // 思考中若已有消息（含刚发出的问题），保留消息列表 + 行内"输入中"指示，
  // 只有首个问题才展示整屏思考动画，避免大图盖住对话内容
  const thinking = chatState === "thinking";
  const showChatting = chatState === "chatting" || (thinking && messages.length > 0);

  return (
    <View className="learn">
      <View className="learn__header">
        <View className="learn__header-row">
          <View className="learn__header-actions">
            <View
              className="btn-new-chat"
              onClick={() => {
                vibrateIfEnabled();
                startNewChat();
              }}
            >
              ＋ 新对话
            </View>
            <View
              className="learn__history-btn"
              onClick={() => {
                vibrateIfEnabled();
                goHistory();
              }}
            >
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
        {thinking && messages.length === 0 && <ThinkingState />}
        {showChatting && <ChattingState messages={messages} thinking={thinking} />}
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
        onImageGen={() => setImageGenOpen(true)}
        onMaterial={() => setMaterialOpen(true)}
      />

      <MaterialPanel
        visible={materialOpen}
        onClose={() => setMaterialOpen(false)}
      />

      <ImageGenPanel
        visible={imageGenOpen}
        onClose={() => setImageGenOpen(false)}
        onGenerated={handleImageGenerated}
      />

      <CustomTabBar currentTab="learn" />
    </View>
  );
};

export default Learn;
