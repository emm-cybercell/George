export interface MenuItem {
  icon: string;
  label: string;
  sub: string;
}

export const menus: MenuItem[] = [
  { icon: "🎨", label: "我的作品集", sub: "My AI Projects" },
  { icon: "📖", label: "学习记录", sub: "Learning History" },
  { icon: "⚙️", label: "系统设置", sub: "Settings" },
];
