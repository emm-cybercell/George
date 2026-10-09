/**
 * 学习页两个非对话状态组件（与 ChattingState 同域，就近放置）：
 * - IdleState：空闲欢迎态（立绘 + 建议提问 pill）
 * - ThinkingState：首问整屏思考态（无消息时的思考动画）
 * PromptPill 建议 pill 原独立组件仅 IdleState 使用，一并内联
 */
import { View, Text, Image } from "@tarojs/components";
import mascotImg from "@/assets/images/立绘2.jpg";
import thinkingImg from "@/assets/images/思考.jpg";
import "../ChattingState/index.scss";
import "./states.scss";

/** 建议提问 pill（原 PromptPill 组件内联） */
const PromptPill = ({
  label,
  icon,
  onTap,
}: {
  label: string;
  icon?: string;
  onTap: () => void;
}) => (
  <View className="prompt-pill" onClick={onTap}>
    {icon ? <Text className="prompt-pill__icon">{icon}</Text> : null}
    <Text className="prompt-pill__label">{label}</Text>
  </View>
);

interface IdleStateProps {
  prompts: string[];
  onPrompt: (text: string) => void;
}

const PROMPT_ICONS = ["🤔", "🪄", "🎮"];

export const IdleState = ({ prompts, onPrompt }: IdleStateProps) => (
  <View className="idle-state card-animate">
    <Image className="idle-state__mascot" src={mascotImg} mode="aspectFit" />
    <Text className="idle-state__greeting">你好！我是桥智同学 👏</Text>
    <View className="idle-state__section-title">👇 试试问我这些</View>
    <View className="idle-state__prompts">
      {prompts.map((p, i) => (
        <PromptPill
          key={p}
          label={p}
          icon={PROMPT_ICONS[i] ?? "✨"}
          onTap={() => onPrompt(p)}
        />
      ))}
    </View>
  </View>
);

export const ThinkingState = () => (
  <View className="thinking-state">
    <Image
      className="thinking-state__mascot"
      src={thinkingImg}
      mode="aspectFit"
    />
    <View className="thinking-state__pulse">
      <Text className="thinking-state__text">桥智同学正在思考中...</Text>
    </View>
  </View>
);
