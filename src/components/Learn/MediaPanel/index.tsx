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
}

interface UploadOption {
  key: string;
  icon: string;
  label: string;
  sub: string;
  sourceType: ("camera" | "album")[];
  mediaType: ("image" | "video")[];
  file?: boolean;
}

const UPLOAD_OPTIONS: UploadOption[] = [
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

/** 更多能力入口（AI 生图：文生图 / 图生图） */
interface ActionEntry {
  key: string;
  icon: string;
  label: string;
  sub: string;
  onClick: () => void;
}

const MediaPanel = ({
  visible,
  onClose,
  onUploaded,
  onImageGen,
}: MediaPanelProps) => {
  if (!visible) return null;

  const actions: ActionEntry[] = [
    {
      key: "imagegen",
      icon: "🎨",
      label: "AI 生图",
      sub: "文生图 / 图生图，混元帮你创作",
      onClick: onImageGen,
    },
  ];

  const handlePick = async (opt: UploadOption) => {
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
        {UPLOAD_OPTIONS.map((opt) => (
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

        <Text className="media-panel__title">更多能力</Text>
        {actions.map((act) => (
          <View
            key={act.key}
            className="media-panel__option"
            onClick={() => {
              onClose();
              act.onClick();
            }}
          >
            <Text className="media-panel__icon">{act.icon}</Text>
            <View className="media-panel__text">
              <Text className="media-panel__label">{act.label}</Text>
              <Text className="media-panel__sub">{act.sub}</Text>
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
