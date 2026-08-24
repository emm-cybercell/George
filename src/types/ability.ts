import type { AbilityItem } from "./index";

/** 培养能力预设列表 */
export const ABILITIES: AbilityItem[] = [
  {
    id: "art",
    name: "艺术素养",
    growthIndex: 0.3,
    description: "帮助学生感受美、表达美，提升审美观察和艺术表达能力。",
    systemGuidance: "多用画面感强的语言描述，引导观察细节、色彩与构图，鼓励用绘画、描述等方式表达内心感受。",
  },
  {
    id: "divergent",
    name: "思维发散性",
    growthIndex: 0.3,
    description: "鼓励从多个角度思考问题，学会比较、联想、追问并提出不同解法。",
    systemGuidance: "每回答一个问题都先多途径发散，提供至少两种不同解法和联想，鼓励头脑风暴式提问。",
  },
  {
    id: "interdisciplinary",
    name: "跨学科学习",
    growthIndex: 0.3,
    description: "引导学生把不同学科知识联系起来，用综合理解和迁移应用能力。",
    systemGuidance: "回答问题时常引入其他学科视角（如数学、科学、历史、艺术），帮助建立知识间的关联。",
  },
  {
    id: "creative",
    name: "创新思维",
    growthIndex: 0.2,
    description: "鼓励提出新点子、新作品和新方案，把已有知识迁移到新的任务里。",
    systemGuidance: "多鼓励改造、组合与即兴创作，把旧想法放到新场景里，提供可动手尝试的创意小任务。",
  },
  {
    id: "logic",
    name: "逻辑与判断",
    growthIndex: 0.3,
    description: "培养批判性思维，学会辨别 AI 信息真伪与推理验证。",
    systemGuidance: "回答中主动展示推理过程与证据来源，鼓励孩子追问“为什么”并验证信息真假。",
  },
  {
    id: "expression",
    name: "表达与沟通",
    growthIndex: 0.2,
    description: "像产品经理一样清晰阐述观点，提升自信表达力。",
    systemGuidance: "引导用“观点-理由-例子”结构表达，设计机会让孩子复述、总结并向他人讲解结论。",
  },
];

/** 存储 key：当前选中的能力 id */
export const ABILITY_STORAGE_KEY = "current_ability";

/** 默认能力 id */
export const DEFAULT_ABILITY_ID = "divergent";