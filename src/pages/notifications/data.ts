export type NoticeType = "achievement" | "tip" | "letter";

export interface NoticeItem {
  id: string;
  type: NoticeType;
  title: string;
  content: string;
  time: string;
}

export interface NoticeTab {
  key: "all" | NoticeType;
  label: string;
}

export const NOTICE_TABS: NoticeTab[] = [
  { key: "all", label: "全部" },
  { key: "achievement", label: "🏆 成就提醒" },
  { key: "tip", label: "💡 学习锦囊" },
  { key: "letter", label: "📬 桥智来信" },
];

/** 预设通知数据 */
export const NOTICES: NoticeItem[] = [
  {
    id: "n1",
    type: "achievement",
    title: "勋章解锁",
    content: "恭喜你解锁勋章【初试啼声】！获得了 10 点探索积分。",
    time: "10-09 14:02",
  },
  {
    id: "n2",
    type: "achievement",
    title: "三日坚持",
    content: "连续打卡 3 天达成！解锁【三日坚持】勋章，继续保持吧 🔥",
    time: "10-08 09:30",
  },
  {
    id: "n3",
    type: "tip",
    title: "今日小技巧",
    content:
      "今天试试让桥智同学帮你检查一段写话吧，记得用「AI 小法官」原则哦！",
    time: "10-07 18:45",
  },
  {
    id: "n4",
    type: "letter",
    title: "来自 2035 的信件",
    content: "来自 2035 年的信件：未来的智能城市又多了一位小建筑师……",
    time: "10-06 20:11",
  },
  {
    id: "n5",
    type: "tip",
    title: "提问小技巧",
    content: "把大问题拆成小问题问桥智同学，答案会更精彩哦 ✨",
    time: "10-05 12:20",
  },
];
