export type FeatureType = "observation" | "lab" | "ask-future" | "diary";

export interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
  type: FeatureType;
  /** 主题色，用于顶部彩色条与图标徽章 */
  color: string;
}

export const features: FeatureItem[] = [
  {
    icon: "🔍",
    title: "桥智观察站",
    desc: "带孩子看懂 AI 世界的新鲜事",
    type: "observation",
    color: "#2563EB",
  },
  {
    icon: "🧪",
    title: "桥智实验室",
    desc: "动手玩 AI，做出自己的小作品",
    type: "lab",
    color: "#06B6D4",
  },
  {
    icon: "💬",
    title: "桥智问未来",
    desc: "好奇心提问站，和 AI 一起探索",
    type: "ask-future",
    color: "#16A34A",
  },
  {
    icon: "📓",
    title: "桥智成长日记",
    desc: "记录每一次思考与进步",
    type: "diary",
    color: "#7C3AED",
  },
];

export const teamTags = ["🎓 资深导师", "🤖 AI 技术支持", "📚 课程专家"];
