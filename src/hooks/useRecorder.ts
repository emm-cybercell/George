import { useRef, useState } from "react";
import Taro from "@tarojs/taro";

/**
 * 语音识别管理器 hook（WechatSI 同声传译插件）。
 * 注意：插件回调必须采用"赋值式"注册（manager.onStart = fn），不能用方法调用式。
 */
export function useRecorder(onRecognized: (text: string) => void) {
  const rmRef = useRef<WechatSI.RecordRecognitionManager | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  /** 初始化识别管理器（调用前需确保插件已开通） */
  const init = () => {
    const rm = requirePlugin("WechatSI").getRecordRecognitionManager();
    rmRef.current = rm;

    rm.onStart = () => {
      setIsRecording(true);
      Taro.showToast({ title: "桥智同学正在倾听中...", icon: "none" });
    };

    rm.onRecognize = (res) => {
      if (res.result) onRecognized(res.result);
    };

    rm.onStop = (res) => {
      onRecognized(res.result);
      setIsRecording(false);
      Taro.showToast({
        title: res.result ? "已听清，点击发送即可" : "没听清，再说一次吧",
        icon: "none",
      });
    };

    rm.onError = (err) => {
      setIsRecording(false);
      console.log("WechatSI onError:", JSON.stringify(err));
      Taro.showToast({
        title: `录音失败：${err?.msg || "请检查麦克风权限"}`,
        icon: "none",
      });
    };
  };

  /** 开始/停止录音切换 */
  const toggle = () => {
    const rm = rmRef.current;
    if (!rm) {
      Taro.showToast({ title: "语音识别暂不可用", icon: "none" });
      return;
    }
    if (isRecording) {
      rm.stop();
      return;
    }
    rm.start({ duration: 30000, lang: "zh_CN" });
  };

  /** 页面隐藏时静默停止录音 */
  const stopIfRecording = () => {
    if (isRecording && rmRef.current) {
      rmRef.current.stop();
    }
  };

  return { init, toggle, isRecording, stopIfRecording };
}
