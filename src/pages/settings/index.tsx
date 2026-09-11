import { useState } from "react";
import { View, Text, Switch } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

const TTS_KEY = "settings_tts";
const VIBE_KEY = "settings_vibe";
/** 清理缓存时保留的关键数据 */
const KEEP_KEYS = ["user_account", "current_ability", TTS_KEY, VIBE_KEY];
const APP_VERSION = "v1.0.2 (2035 Release)";

const Settings = () => {
  const [tts, setTts] = useState<boolean>(!!Taro.getStorageSync(TTS_KEY));
  const [vibe, setVibe] = useState<boolean>(
    Taro.getStorageSync(VIBE_KEY) === ""
      ? true
      : !!Taro.getStorageSync(VIBE_KEY),
  );
  const [cacheKB, setCacheKB] = useState<number>(
    Taro.getStorageInfoSync().currentSize || 0,
  );

  const onTtsChange = (value: boolean) => {
    setTts(value);
    Taro.setStorageSync(TTS_KEY, value);
  };

  const onVibeChange = (value: boolean) => {
    setVibe(value);
    Taro.setStorageSync(VIBE_KEY, value);
    if (value) {
      Taro.vibrateShort({ type: "light" });
    }
  };

  // 清理缓存：保留用户档案与偏好设置
  const handleClearCache = () => {
    const kept = KEEP_KEYS.map((k) => ({
      k,
      v: Taro.getStorageSync(k),
    })).filter((x) => x.v !== "");
    Taro.clearStorageSync();
    kept.forEach(({ k, v }) => Taro.setStorageSync(k, v));
    setCacheKB(0);
    Taro.showToast({ title: "缓存已清理 ✨", icon: "success" });
  };

  const showPrivacy = () => {
    Taro.showModal({
      title: "青少年保护与隐私政策",
      content:
        "桥智同学严格遵循未成年人保护规范：不上传真实身份信息，对话内容仅用于学习辅导，AI 回答均经过内容安全审核。监护人可随时在设置中重置本地数据。",
      showCancel: false,
      confirmColor: "#8B5CF6",
    });
  };

  const handleReset = () => {
    Taro.showModal({
      title: "重置本地学习进度",
      content: "将清除本地全部学习数据与档案（云端数据不受影响），确定继续吗？",
      confirmColor: "#ef4444",
      success: (res) => {
        if (!res.confirm) return;
        Taro.clearStorageSync();
        setTts(false);
        setVibe(true);
        setCacheKB(0);
        Taro.showToast({ title: "已重置本地进度", icon: "success" });
      },
    });
  };

  return (
    <View className="settings">
      <View className="settings__header">
        <View className="settings__header-row">
          <View className="settings__back" onClick={() => Taro.navigateBack()}>
            ‹ 返回
          </View>
          <Text className="settings__title">设置</Text>
        </View>
      </View>

      <View className="settings__body">
        <View className="settings-group">
          <Text className="settings-group__title">交互偏好</Text>
          <View className="settings-group__card">
            <View className="settings-cell">
              <Text className="settings-cell__icon">🔊</Text>
              <View className="settings-cell__text">
                <Text className="settings-cell__label">
                  AI 语音回复自动朗读
                </Text>
                <Text className="settings-cell__sub">
                  收到回复时自动语音播报
                </Text>
              </View>
              <Switch
                checked={tts}
                onChange={(e) => onTtsChange(e.detail.value)}
                color="#8B5CF6"
              />
            </View>
            <View className="settings-cell">
              <Text className="settings-cell__icon">📳</Text>
              <View className="settings-cell__text">
                <Text className="settings-cell__label">点击触感震动反馈</Text>
                <Text className="settings-cell__sub">操作按钮时轻微震动</Text>
              </View>
              <Switch
                checked={vibe}
                onChange={(e) => onVibeChange(e.detail.value)}
                color="#8B5CF6"
              />
            </View>
          </View>
        </View>

        <View className="settings-group">
          <Text className="settings-group__title">存储与数据</Text>
          <View className="settings-group__card">
            <View className="settings-cell" onClick={handleClearCache}>
              <Text className="settings-cell__icon">🧹</Text>
              <View className="settings-cell__text">
                <Text className="settings-cell__label">清理本地缓存</Text>
                <Text className="settings-cell__sub">
                  当前占用 {(cacheKB / 1024).toFixed(2)} MB
                </Text>
              </View>
              <Text className="settings-cell__arrow">›</Text>
            </View>
          </View>
        </View>

        <View className="settings-group">
          <Text className="settings-group__title">关于与合规</Text>
          <View className="settings-group__card">
            <View className="settings-cell" onClick={showPrivacy}>
              <Text className="settings-cell__icon">📄</Text>
              <View className="settings-cell__text">
                <Text className="settings-cell__label">
                  青少年保护与隐私政策
                </Text>
              </View>
              <Text className="settings-cell__arrow">›</Text>
            </View>
            <View className="settings-cell">
              <Text className="settings-cell__icon">ℹ️</Text>
              <View className="settings-cell__text">
                <Text className="settings-cell__label">关于桥智同学</Text>
              </View>
              <Text className="settings-cell__version">{APP_VERSION}</Text>
            </View>
          </View>
        </View>

        <View className="settings__reset" onClick={handleReset}>
          <Text>重置本地学习进度</Text>
        </View>
      </View>
    </View>
  );
};

export default Settings;
