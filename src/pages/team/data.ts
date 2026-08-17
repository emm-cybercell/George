export interface Mentor {
  icon: string;
  role: string;
  desc: string;
}

export const mentors: Mentor[] = [
  {
    icon: "🤖",
    role: "AI 算法工程师",
    desc: "把复杂技术翻译成孩子听得懂的话",
  },
  {
    icon: "🎓",
    role: "一线素质教育专家",
    desc: "深谙 8-14 岁孩子的学习心理与节奏",
  },
  {
    icon: "🎙️",
    role: "播音主持表达导师",
    desc: "让孩子敢开口、会表达、有自信",
  },
];
