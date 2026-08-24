import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { ABILITIES, ABILITY_STORAGE_KEY, DEFAULT_ABILITY_ID } from "@/types/ability";
import "./index.scss";

const AbilityCard = () => {
  const currentId =
    Taro.getStorageSync(ABILITY_STORAGE_KEY) || DEFAULT_ABILITY_ID;
  const current =
    ABILITIES.find((a) => a.id === currentId) || ABILITIES[1];

  const onTap = () => {
    Taro.navigateTo({ url: "/pages/ability-setting/index" });
  };

  return (
    <View className="ability-card card-animate" onClick={onTap}>
      <Text className="ability-card__icon">🎯</Text>
      <View className="ability-card__text">
        <Text className="ability-card__label">专属培养方向</Text>
        <View className="ability-card__pill">
          <Text className="ability-card__pill-text">{current.name}</Text>
        </View>
      </View>
      <Text className="ability-card__switch">切换 ›</Text>
    </View>
  );
};

export default AbilityCard;