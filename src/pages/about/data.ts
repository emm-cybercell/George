export interface Pillar {
  icon: string;
  title: string;
  en: string;
  desc: string;
}

export interface RuleCard {
  color: string;
  label: string;
  zone: string;
  examples: string[];
}

export const pillars: Pillar[] = [
  {
    icon: "🎨",
    title: "创造",
    en: "Create",
    desc: "用 AI 做能玩能看的作品",
  },
  {
    icon: "🔍",
    title: "判断",
    en: "Judge",
    desc: "当'小法官'，验证 AI 答案真伪",
  },
  {
    icon: "🗣️",
    title: "表达",
    en: "Express",
    desc: "讲清创作与修改过程",
  },
];

export const ruleCards: RuleCard[] = [
  {
    color: "green",
    label: "通行区",
    zone: "绿色 (通行区)",
    examples: ["查资料", "看科普", "激发灵感"],
  },
  {
    color: "yellow",
    label: "思考区",
    zone: "黄色 (思考区)",
    examples: ["验算", "润色", "错题讲解（过一道手重做）"],
  },
  {
    color: "red",
    label: "禁区",
    zone: "红色 (禁区)",
    examples: ["直接抄答案", "闭卷考试", "基础肌肉记忆训练"],
  },
];
