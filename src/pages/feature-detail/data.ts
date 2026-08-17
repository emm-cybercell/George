export interface FeatureSectionItem {
  text: string;
  /** 可选按钮动作 */
  action?: "start-lab" | "ask";
}

export interface FeatureSection {
  heading: string;
  items: FeatureSectionItem[];
}

export interface FeatureDetail {
  title: string;
  icon: string;
  color: string;
  slogan: string;
  sections: FeatureSection[];
}

const OBSERVATION: FeatureDetail = {
  title: "桥智观察站",
  icon: "🔍",
  color: "#2563EB",
  slogan: "带孩子看懂 AI 世界的新鲜事",
  sections: [
    {
      heading: "今日 AI 新鲜事",
      items: [
        { text: "AI 正在制作 3D 动画——输入一句话就能生成一段小短片。" },
        { text: "机器狗学会了新技能：搬运、巡逻，还会对人摇尾巴互动。" },
        { text: "科学家用 AI 帮助寻找新药方，加速解决人类难题。" },
      ],
    },
    {
      heading: "科技小脑洞",
      items: [
        { text: "如果 AI 会画画，未来的插画师需要学会什么能力？" },
        { text: "如果 AI 帮你写作业，你还需要练习什么？" },
        { text: "AI 什么都能做，那什么才是只有人类能做的？" },
      ],
    },
    {
      heading: "观察家小任务",
      items: [
        { text: "找一找：今天你身边出现了哪些 AI 应用？" },
        { text: "记一记：它们帮人类解决了什么问题？" },
        { text: "想一想：如果让你改进其中一种，你会怎么做？" },
      ],
    },
  ],
};

const LAB: FeatureDetail = {
  title: "桥智实验室",
  icon: "🧪",
  color: "#06B6D4",
  slogan: "动手玩 AI，做出自己的小作品",
  sections: [
    {
      heading: "热门创作工坊",
      items: [
        { text: "【AI 故事绘本】请 AI 帮你画场景，再自己编故事配文。" },
        { text: "【我的专属 3D 头像】用提示词生成立体风格头像。" },
        { text: "【迷你文字冒险游戏】让 AI 当向导，编写闯关剧情。" },
      ],
    },
    {
      heading: "实验室四步法",
      items: [
        { text: "灵感定义：想清楚你要做什么、给谁用。" },
        { text: "魔法指令：用角色＋任务＋规则＋格式描述需求。" },
        { text: "成果生成：让 AI 产出第一版作品。" },
        { text: "调试优化：哪里不满意，改指令再来一轮。" },
      ],
    },
    {
      heading: "开始实验",
      items: [
        {
          text: "到学习页找桥智同学，实践你的第一个小作品吧！",
          action: "start-lab",
        },
      ],
    },
  ],
};

const ASK_FUTURE: FeatureDetail = {
  title: "桥智问未来",
  icon: "💬",
  color: "#16A34A",
  slogan: "好奇心提问站，和 AI 一起探索",
  sections: [
    {
      heading: "青少年热门提问榜",
      items: [
        { text: "黑洞里面究竟有什么？", action: "ask" },
        { text: "AI 也会做梦吗？", action: "ask" },
        { text: "2035 年的学校是什么样？", action: "ask" },
      ],
    },
    {
      heading: "提问魔法锦囊",
      items: [
        { text: "带上背景：告诉 AI 你的年级和你已经知道的部分。" },
        { text: "限定条件：说清回答的形式，如三个步骤、举例说明。" },
        { text: "追问到底：得到答案后再问“为什么”和“还有吗”。" },
      ],
    },
    {
      heading: "一键提问",
      items: [
        {
          text: "点击上方热门问题，自动带着问题去找桥智同学！",
          action: "ask",
        },
      ],
    },
  ],
};

const DIARY: FeatureDetail = {
  title: "桥智成长日记",
  icon: "📓",
  color: "#7C3AED",
  slogan: "记录每一次思考与进步",
  sections: [
    {
      heading: "我的成长看板",
      items: [
        { text: "AI 探索次数：每一次提问与实验都算一次冒险。" },
        { text: "解锁技能卡：提示词、判断力、表达力……逐步点亮。" },
        { text: "创作作品数：绘本、头像、小游戏，都是你的作品集。" },
      ],
    },
    {
      heading: "AI 作业反思卡",
      items: [
        { text: "绿区启发：今天有没有用 AI 查资料、看科普？" },
        { text: "黄区过脑：做错题时，有没有先自己重做一遍？" },
        { text: "红区禁抄：有没有做到不直接抄答案？" },
      ],
    },
    {
      heading: "勋章进阶之路",
      items: [
        { text: "当前等级：学习达人，正在向「未来创造者 LV.4」前进。" },
        { text: "达成方式：再完成 3 次创作与 2 次反思的记录。" },
        { text: "每次记录都会点亮一枚进度星，坚持就能升级！" },
      ],
    },
  ],
};

export const FEATURE_MAP: Record<string, FeatureDetail> = {
  observation: OBSERVATION,
  lab: LAB,
  "ask-future": ASK_FUTURE,
  diary: DIARY,
};
