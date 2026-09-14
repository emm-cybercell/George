import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { uploadMediaToCloud } from "@/api/works";
import "./index.scss";

interface MediaPanelProps {
  visible: boolean;
  onClose: () => void;
  /** 上传成功回调（fileID 为 cloud:// 路径） */
  onUploaded: (fileID: string) => void;
  /** AI 生图入口回调 */
  onImageGen: () => void;
  /** 个人学习资料库入口回调 */
  onMaterial?: () => void;
}

interface PanelOption {
  key: string;
  icon: string;
  label: string;
  sub: string;
}

const OPTIONS: PanelOption[] = [
  {
    key: "camera",
    icon: "📸",
    label: "拍照 / 拍作品",
    sub: "用相机记录你的创意作品",
  },
  {
    key: "album",
    icon: "🖼️",
    label: "相册照片 / 视频",
    sub: "从相册挑选画作与照片",
  },
  {
    key: "file",
    icon: "📁",
    label: "聊天文件",
    sub: "选择微信聊天中的文件",
  },
];

const EXTRA_OPTIONS: PanelOption[] = [
  {
    key: "imagegen",
    icon: "🎨",
    label: "AI 生图",
    sub: "文生图 / 图生图，混元帮你创作",
  },
  {
    key: "material",
    icon: "📚",
    label: "上传学习资料",
    sub: "教材 / 习题拍照识字或粘贴文本，存入我的资料库",
  },
];

const MediaPanel = ({
  visible,
  onClose,
  onUploaded,
  onImageGen,
  onMaterial,
}: MediaPanelProps) => {
  if (!visible) return null;

  const handleUpload = async (opt: PanelOption) => {
    try {
      let tempPath = "";
      if (opt.key === "file") {
        const res = await Taro.chooseMessageFile({ count: 1, type: "file" });
        tempPath = res.tempFiles[0].path;
      } else {
        const res = await Taro.chooseMedia({
          count: 1,
          mediaType: opt.key === "camera" ? ["image"] : ["image", "video"],
          sourceType: opt.key === "camera" ? ["camera"] : ["album"],
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

  const handleTap = (opt: PanelOption) => {
    if (opt.key === "imagegen") {
      onClose();
      onImageGen();
      return;
    }
    if (opt.key === "material") {
      onClose();
      onMaterial?.();
      return;
    }
    handleUpload(opt);
  };

  const renderItem = (opt: PanelOption) => (
    <View key={opt.key} className="media-panel__option" onClick={() => handleTap(opt)}>
      <Text className="media-panel__icon">{opt.icon}</Text>
      <View className="media-panel__text">
        <Text className="media-panel__label">{opt.label}</Text>
        <Text className="media-panel__sub">{opt.sub}</Text>
      </View>
      <Text className="media-panel__arrow">›</Text>
    </View>
  );

  return (
    <View className="media-panel">
      <View className="media-panel__mask" onClick={onClose} />
      <View className="media-panel__card">
        <Text className="media-panel__title">更多能力</Text>
        <View className="media-panel__scroll">
          {OPTIONS.map(renderItem)}
          <View className="media-panel__divider" />
          {EXTRA_OPTIONS.map(renderItem)}
        </View>
        <View className="media-panel__cancel" onClick={onClose}>
          取消
        </View>
      </View>
    </View>
  );
};

export default MediaPanel;
