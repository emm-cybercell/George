import { View, Text } from "@tarojs/components";
import { menus } from "@/pages/profile/data";
import "./index.scss";

const MenuList = () => {
  return (
    <View className="menu-list">
      {menus.map((item) => (
        <View className="menu-list__item" key={item.label}>
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
