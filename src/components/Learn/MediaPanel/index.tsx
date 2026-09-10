import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { uploadMediaToCloud } from "@/api/works";
import "./index.scss";

interface MediaPanelProps {
  visible: boolean;
  onClose: () => void;
  /** 上传成功回调（fileID 为 cloud:// 路径） */
  onUploaded: (fileID: string) => void;
}

interface MediaOption {
  key: string;
  icon: string;
  label: string;
  sub: string;
  sourceType: ("camera" | "album")[];
  mediaType: ("image" | "video")[];
  file?: boolean;
}

const OPTIONS: MediaOption[] = [
  {
    key: "camera",
    icon: "📸",
    label: "拍照 / 拍作品",
    sub: "用相机记录你的创意作品",
    sourceType: ["camera"],
    mediaType: ["image"],
  },
  {
    key: "album",
    icon: "🖼️",
    label: "相册照片 / 视频",
    sub: "从相册挑选画作与照片",
    sourceType: ["album"],
    mediaType: ["image", "video"],
  },
  {
    key: "file",
    icon: "📁",
    label: "聊天文件",
    sub: "选择微信聊天中的文件",
    sourceType: [],
    mediaType: [],
    file: true,
  },
];

const MediaPanel = ({ visible, onClose, onUploaded }: MediaPanelProps) => {
  if (!visible) return null;

  const handlePick = async (opt: MediaOption) => {
    try {
      let tempPath = "";
      if (opt.file) {
        const res = await Taro.chooseMessageFile({ count: 1, type: "file" });
        tempPath = res.tempFiles[0].path;
      } else {
        const res = await Taro.chooseMedia({
          count: 1,
          mediaType: opt.mediaType,
          sourceType: opt.sourceType,
        });
        tempPath = res.tempFiles[0].tempFilePath;
      }
      Taro.showLoading({ title: "作品上传中..." });
      const fileID = await uploadMediaToCloud(tempPath, "works");
      Taro.hideLoading();
      onClose();
      onUploaded(fileID);
    } catch (err) {
      Taro.hideLoading();
      // 用户取消选择不提示
      const msg = (err as { errMsg?: string })?.errMsg || "";
      if (!msg.includes("cancel")) {
        Taro.showToast({ title: "上传失败，请重试", icon: "none" });
      }
    }
  };

  return (
    <View className="media-panel">
      <View className="media-panel__mask" onClick={onClose} />
      <View className="media-panel__card">
        <Text className="media-panel__title">上传作品</Text>
        {OPTIONS.map((opt) => (
          <View
            key={opt.key}
            className="media-panel__option"
            onClick={() => handlePick(opt)}
          >
            <Text className="media-panel__icon">{opt.icon}</Text>
            <View className="media-panel__text">
              <Text className="media-panel__label">{opt.label}</Text>
              <Text className="media-panel__sub">{opt.sub}</Text>
            </View>
            <Text className="media-panel__arrow">›</Text>
          </View>
        ))}
        <View className="media-panel__cancel" onClick={onClose}>
          取消
        </View>
      </View>
    </View>
  );
};

export default MediaPanel;
