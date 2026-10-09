import { useState } from "react";
import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";

interface ChatMediaImageProps {
  src: string;
}

/** 聊天图片消息：加载失败（如历史遗留的 24h 临时链接过期）时渲染占位，避免裂图 */
const ChatMediaImage = ({ src }: ChatMediaImageProps) => {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <View className="chatting-state__media chatting-state__media--broken">
        <Text>🖼️ 图片已过期</Text>
      </View>
    );
  }
  return (
    <Image
      className="chatting-state__media"
      src={src}
      mode="aspectFill"
      onError={() => setBroken(true)}
      onClick={() => Taro.previewImage({ urls: [src], current: src })}
    />
  );
};

export default ChatMediaImage;
