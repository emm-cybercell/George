import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import type { TabKey } from "@/types";
import "./index.scss";

interface TabItem {
  key: TabKey;
  label: string;
  icon: string;
  path: string;
}

const TABS: TabItem[] = [
  { key: "learn", label: "学习", icon: "📖", path: "/pages/learn/index" },
  { key: "home", label: "首页", icon: "🏠", path: "/pages/home/index" },
  { key: "profile", label: "我的", icon: "👤", path: "/pages/profile/index" },
];

interface CustomTabBarProps {
  currentTab: TabKey;
}

const CustomTabBar = ({ currentTab }: CustomTabBarProps) => {
  const handleTap = (path: string, key: TabKey) => {
    if (key === currentTab) return;
    // 已移除原生 tabBar，switchTab 会失败，改用 redirectTo 切换页面
    Taro.redirectTo({ url: path });
  };

  return (
    <View className="custom-tabbar">
      {TABS.map((item) => {
        const active = item.key === currentTab;
        return (
          <View
            key={item.key}
            className={`custom-tabbar__item ${active ? "custom-tabbar__item--active" : ""}`}
            onClick={() => handleTap(item.path, item.key)}
          >
            <Text className="custom-tabbar__indicator" />
            <Text className="custom-tabbar__icon">{item.icon}</Text>
            <Text className="custom-tabbar__label">{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
};

export default CustomTabBar;
