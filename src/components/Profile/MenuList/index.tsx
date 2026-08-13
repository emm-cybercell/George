import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { menus } from "@/pages/profile/data";
import "./index.scss";

const MenuList = () => {
  const onTap = (label: string) => {
    if (label === "学习记录") {
      Taro.navigateTo({ url: "/pages/history/index" });
    } else {
      Taro.showToast({ title: "功能开发中，敬请期待", icon: "none" });
    }
  };

  return (
    <View className="menu-list">
      {menus.map((item) => (
        <View
          className="menu-list__item"
          key={item.label}
          onClick={() => onTap(item.label)}
        >
          <Text className="menu-list__icon">{item.icon}</Text>
          <View className="menu-list__text">
            <Text className="menu-list__label">{item.label}</Text>
            <Text className="menu-list__sub">{item.sub}</Text>
          </View>
          <Text className="menu-list__arrow">›</Text>
        </View>
      ))}
    </View>
  );
};

export default MenuList;
