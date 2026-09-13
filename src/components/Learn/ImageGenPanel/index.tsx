import { useState } from "react";
import { View, Text, Input, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { fileToBase64, generateImage, type ImageGenMode } from "@/api/image";
import "./index.scss";

interface ImageGenPanelProps {
  visible: boolean;
  onClose: () => void;
  /** 生成成功回调（返回图片 URL） */
  onGenerated: (imageUrl: string, prompt: string) => void;
}

const MODES: Array<{ id: ImageGenMode; name: string; hint: string }> = [
  { id: "t2i", name: "文生图", hint: "描述想生成的画面，比如：赛博朋克小猫咪在火星上滑板" },
  { id: "i2i", name: "图生图", hint: "描述想要的改动，比如：把小猫改成水彩风格" },
];

/** 生图面板：文生图 / 图生图双模式 */
const ImageGenPanel = ({ visible, onClose, onGenerated }: ImageGenPanelProps) => {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<ImageGenMode>("t2i");
  const [refImage, setRefImage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState("");

  if (!visible) return null;

  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0];

  const chooseRefImage = async () => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        sizeType: ["compressed"],
      });
      setRefImage(res.tempFiles[0].tempFilePath);
    } catch {
      /* 用户取消选择 */
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Taro.showToast({ title: "请输入想要生成的画面描述", icon: "none" });
      return;
    }
    if (mode === "i2i" && !refImage) {
      Taro.showToast({ title: "请先选择一张参考图片", icon: "none" });
      return;
    }
    setGenerating(true);
    setPreview("");
    Taro.showLoading({ title: "脑洞生成中..." });
    try {
      const imageBase64 =
        mode === "i2i" ? await fileToBase64(refImage) : undefined;
      const res = await generateImage({ prompt: prompt.trim(), mode, imageBase64 });
      if (res.success && res.imageUrl) {
        setPreview(res.imageUrl);
        onGenerated(res.imageUrl, prompt.trim());
      } else {
        Taro.showToast({ title: res.error || "生图失败", icon: "none" });
      }
    } finally {
      Taro.hideLoading();
      setGenerating(false);
    }
  };

  return (
    <View className="img-panel">
      <View className="img-panel__mask" onClick={onClose} />
      <View className="img-panel__card">
        <Text className="img-panel__title">🎨 AI 生图</Text>

        <View className="img-panel__modes">
          {MODES.map((m) => (
            <View
              key={m.id}
              className={`img-panel__mode ${mode === m.id ? "img-panel__mode--active" : ""}`}
              onClick={() => setMode(m.id)}
            >
              <Text>{m.name}</Text>
            </View>
          ))}
        </View>

        {mode === "i2i" && (
          <View
            className={`img-panel__picker ${refImage ? "img-panel__picker--filled" : ""}`}
            onClick={chooseRefImage}
          >
            {refImage ? (
              <Image className="img-panel__ref" src={refImage} mode="aspectFill" />
            ) : (
              <Text className="img-panel__picker-hint">＋ 选择参考图片</Text>
            )}
          </View>
        )}

        <Input
          className="img-panel__input"
          value={prompt}
          onInput={(e) => setPrompt(e.detail.value)}
          placeholder={activeMode.hint}
          maxlength={120}
        />

        {preview ? (
          <Image
            className="img-panel__preview"
            src={preview}
            mode="aspectFit"
            onClick={() => Taro.previewImage({ urls: [preview], current: preview })}
          />
        ) : generating ? (
          <View className="img-panel__loading">
            <Text>正在发挥想象力…</Text>
          </View>
        ) : null}

        <View className="img-panel__actions">
          <View className="img-panel__cancel" onClick={onClose}>
            取消
          </View>
          <View className="img-panel__go" onClick={handleGenerate}>
            {generating ? "生成中…" : "✨ 生成"}
          </View>
        </View>
      </View>
    </View>
  );
};

export default ImageGenPanel;
