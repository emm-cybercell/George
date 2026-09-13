import Taro from "@tarojs/taro";
import { getAppSettings } from "./settings";

/** WechatSI 语音合成结果 */
interface TtsResult {
  /** 合成音频临时文件路径 */
  filename: string;
}

interface TtsError {
  errMsg: string;
}

interface TtsParams {
  lang: string;
  content: string;
  success: (res: TtsResult) => void;
  fail: (err: TtsError) => void;
}

/** 微信同声传译插件（已在 app.config.ts 注册） */
interface WechatSIPlugin {
  textToSpeech: (params: TtsParams) => void;
}

/** 超长文本截断上限，防止合成超时与重播叠加 */
const TEXT_LIMIT = 120;

/** 语音播放状态（loading = 合成中） */
export type VoiceStatus = "playing" | "paused" | "stopped" | "loading";

let activePlayer: ReturnType<typeof Taro.createInnerAudioContext> | null = null;
let activeToken: string | null = null;
let activeStatus: VoiceStatus = "stopped";
/** 正在合成中的 token（合成需 1~2s，防重复点击导致双音叠播） */
let pendingToken: string | null = null;
/** 状态变化订阅（供 UI 按钮刷新图标） */
const listeners = new Set<(token: string | null, s: VoiceStatus) => void>();

function notify(): void {
  listeners.forEach((fn) => fn(activeToken, activeStatus));
}

export function onVoiceChange(
  fn: (token: string | null, s: VoiceStatus) => void,
): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getVoiceState(): { token: string | null; status: VoiceStatus } {
  return { token: activeToken, status: activeStatus };
}

function disposePlayer(): void {
  if (!activePlayer) return;
  try {
    activePlayer.stop();
  } catch (err) {
    console.warn("stop voice failed:", err);
  }
  try {
    activePlayer.destroy();
  } catch (err) {
    console.warn("destroy voice failed:", err);
  }
  activePlayer = null;
  activeToken = null;
  activeStatus = "stopped";
}

function createPlayer(result: TtsResult, token: string): void {
  // 合成期间用户已切换到其他消息：丢弃过期音频，避免叠音
  if (pendingToken !== token) return;
  pendingToken = null;
  disposePlayer();

  const player = Taro.createInnerAudioContext();
  activePlayer = player;
  activeToken = token;
  activeStatus = "playing";
  player.src = result.filename;

  player.onPlay(() => {
    if (activeToken === token) {
      activeStatus = "playing";
      notify();
    }
  });

  player.onPause(() => {
    if (activeToken === token) {
      activeStatus = "paused";
      notify();
    }
  });

  player.onEnded(() => {
    disposePlayer();
    notify();
  });

  player.onError(() => {
    disposePlayer();
    notify();
  });

  notify();
  player.play();
}

/**
 * 点击播报按钮：同一条消息重复点击 = 播放/暂停切换；点击其他消息 = 切换音频。
 * 合成进行中重复点击同一消息会被忽略（防叠音），合成完成后自动播放。
 */
export function toggleTextVoice(
  text: string,
  token: string,
  force = false,
): VoiceStatus {
  if (!text.trim()) return "stopped";
  if (!force && !getAppSettings().voiceAutoPlay) return "stopped";

  // 合成进行中：同 token 忽略（等待自动播放），异 token 切换目标
  if (pendingToken) {
    if (pendingToken === token) return "loading";
    pendingToken = null;
  }

  if (activeToken === token && activePlayer) {
    if (activeStatus === "playing") {
      activePlayer.pause();
      activeStatus = "paused";
      notify();
      return "paused";
    }
    activePlayer.play();
    activeStatus = "playing";
    notify();
    return "playing";
  }

  disposePlayer();
  notify();

  let plugin: WechatSIPlugin | null = null;
  try {
    plugin = Taro.requirePlugin("WechatSI") as unknown as WechatSIPlugin;
  } catch (err) {
    console.warn("WechatSI 插件不可用:", err);
    return "stopped";
  }
  if (!plugin || typeof plugin.textToSpeech !== "function") return "stopped";

  const pureText = text.replace(/[#*`_~]/g, "").slice(0, TEXT_LIMIT);
  pendingToken = token;
  activeStatus = "loading";
  notify();
  plugin.textToSpeech({
    lang: "zh_CN",
    content: pureText,
    success: (res: TtsResult) => createPlayer(res, token),
    fail: (err) => {
      console.error("语音合成失败:", err.errMsg);
      if (pendingToken === token) pendingToken = null;
      disposePlayer();
      notify();
    },
  });

  return "loading";
}

/**
 * AI 回复语音朗读（自动播放，受 voiceAutoPlay 开关控制）
 */
export function playTextVoice(text: string, force = false): void {
  if (!text.trim()) return;
  if (!force && !getAppSettings().voiceAutoPlay) return;
  const pureText = text.replace(/[#*`_~]/g, "").slice(0, TEXT_LIMIT);
  toggleTextVoice(pureText, `auto-${pureText}`, true);
}

export function stopCurrentVoice(): void {
  pendingToken = null;
  disposePlayer();
  notify();
}
