import Taro from "@tarojs/taro";

/** 全局应用设置（统一存储于本地缓存 app_settings） */
export interface AppSettings {
  /** AI 语音回复自动朗读 */
  voiceAutoPlay: boolean;
  /** 点击触感震动反馈 */
  hapticFeedback: boolean;
}

const SETTINGS_KEY = "app_settings";
/** 旧版本独立存储 key（迁移用） */
const LEGACY_VIBE_KEY = "settings_vibe";
const LEGACY_TTS_KEY = "settings_tts";

const DEFAULT_SETTINGS: AppSettings = {
  voiceAutoPlay: false,
  hapticFeedback: true,
};

/** 读取本地设置（缺失返回默认值，并兼容旧版独立 key 迁移） */
export function getAppSettings(): AppSettings {
  const cached = Taro.getStorageSync(SETTINGS_KEY);
  if (cached && typeof cached === "object") {
    return { ...DEFAULT_SETTINGS, ...cached };
  }
  const legacyVibe = Taro.getStorageSync(LEGACY_VIBE_KEY);
  const legacyTts = Taro.getStorageSync(LEGACY_TTS_KEY);
  if (legacyVibe !== "" || legacyTts !== "") {
    const migrated: AppSettings = {
      voiceAutoPlay:
        legacyTts === "" ? DEFAULT_SETTINGS.voiceAutoPlay : !!legacyTts,
      hapticFeedback:
        legacyVibe === "" ? DEFAULT_SETTINGS.hapticFeedback : !!legacyVibe,
    };
    Taro.setStorageSync(SETTINGS_KEY, migrated);
    return migrated;
  }
  return { ...DEFAULT_SETTINGS };
}

/** 局部更新设置并即时持久化，返回最新设置 */
export function setAppSetting(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getAppSettings(), ...patch };
  Taro.setStorageSync(SETTINGS_KEY, next);
  return next;
}

/** 触感震动：设置开启时执行轻震动，关闭时静默 */
export function vibrateIfEnabled(): void {
  if (getAppSettings().hapticFeedback) {
    Taro.vibrateShort({ type: "light" });
  }
}
