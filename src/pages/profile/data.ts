import type { BadgeItem } from "@/types";

export interface StatItem {
  icon: string;
  value: string;
  name: string;
}

export interface ProfileBadge extends BadgeItem {
  styleType: "purple" | "green" | "locked";
}

export interface MenuItem {
  icon: string;
  label: string;
  sub: string;
}

export const userInfo = {
  nickname: "未来创造者",
  level: "LV.3 学习达人",
};

export const stats: StatItem[] = [
  { icon: "🎂", value: "10月12日", name: "生日" },
  { icon: "📚", value: "五年级", name: "学龄" },
  { icon: "⭐", value: "1,280", name: "积分" },
];

export const badges: ProfileBadge[] = [
  {
    id: "1",
    title: "未来创造者",
    icon: "🚀",
    unlocked: true,
    styleType: "purple",
  },
  {
    id: "2",
    title: "AI 小法官",
    icon: "⚖️",
    unlocked: true,
    styleType: "purple",
  },
  {
    id: "3",
    title: "提问大师",
    icon: "🙋",
    unlocked: true,
    styleType: "green",
  },
  {
    id: "4",
    title: "待解锁",
    icon: "🔒",
    unlocked: false,
    styleType: "locked",
  },
];

export const menus: MenuItem[] = [
  { icon: "🎨", label: "我的作品集", sub: "My AI Projects" },
  { icon: "📖", label: "学习记录", sub: "Learning History" },
  { icon: "⚙️", label: "设置与关于我们", sub: "Settings & About Us" },
];
