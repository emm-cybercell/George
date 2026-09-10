export interface MenuItem {
  icon: string;
  label: string;
  sub: string;
}

export const menus: MenuItem[] = [
  { icon: "🎨", label: "我的作品集", sub: "My AI Projects" },
  { icon: "📖", label: "学习记录", sub: "Learning History" },
  { icon: "⚙️", label: "设置与关于我们", sub: "Settings & About Us" },
];
