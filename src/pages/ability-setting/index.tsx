import { useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import {
  ABILITIES,
  ABILITY_STORAGE_KEY,
  DEFAULT_ABILITY_ID,
} from "@/types/ability";
import "./index.scss";

const AbilitySetting = () => {
  const [selectedId, setSelectedId] = useState(
    Taro.getStorageSync(ABILITY_STORAGE_KEY) || DEFAULT_ABILITY_ID,
  );

  const goBack = () => {
    Taro.navigateBack();
  };

  const onSave = () => {
    const ability = ABILITIES.find((a) => a.id === selectedId);
    if (!ability) return;
    Taro.setStorageSync(ABILITY_STORAGE_KEY, selectedId);
    Taro.showToast({
      title: `已切换为【${ability.name}】引导模式`,
      icon: "none",
    });
    setTimeout(() => Taro.navigateBack(), 600);
  };

  return (
    <View className="ability-setting">
      <View className="ability-setting__header">
        <View className="ability-setting__back" onClick={goBack}>
          ‹ 返回
        </View>
        <Text className="ability-setting__title">培养方向设置</Text>
      </View>

      <View className="ability-setting__tip card-animate">
        <Text className="ability-setting__tip-text">
          同一时间只能选择一个培养方向。点击保存后，桥智同学会自动切换对应的启发式引导策略。
        </Text>
      </View>

      <ScrollView scrollY className="ability-setting__list">
        {ABILITIES.map((a) => {
          const active = a.id === selectedId;
          return (
            <View
              key={a.id}
              className={`ability-setting__item card-animate ${
                active ? "ability-setting__item--active" : ""
              }`}
              onClick={() => setSelectedId(a.id)}
            >
              <View className="ability-setting__item-text">
                <Text className="ability-setting__item-title">{a.name}</Text>
                <Text className="ability-setting__item-desc">
                  {a.description}
                </Text>
              </View>
              <View className="ability-setting__item-meta">
                <Text className="ability-setting__index">
                  成长指数 {a.growthIndex}
                </Text>
                <Text
                  className={`ability-setting__check ${
                    active ? "ability-setting__check--on" : ""
                  }`}
                >
                  {active ? "✓" : "○"}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View className="ability-setting__footer">
        <View className="ability-setting__save" onClick={onSave}>
          保存并应用
        </View>
      </View>
    </View>
  );
};

export default AbilitySetting;
