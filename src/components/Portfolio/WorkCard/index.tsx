import { View, Text, Image, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import type { CreativeWork } from "@/types";
import "./index.scss";

/** 作品分类展示名 */
export const CATEGORY_LABEL: Record<CreativeWork["category"], string> = {
  drawing: "画作",
  photo: "实物照片",
  story: "故事",
  idea: "灵感",
};

interface WorkCardProps {
  work: CreativeWork;
  onDelete: (id: string) => void;
}

const WorkCard = ({ work, onDelete }: WorkCardProps) => {
  const handleDelete = () => {
    Taro.showModal({
      title: "删除作品",
      content: `确定删除「${work.title}」吗？此操作不可恢复。`,
      confirmColor: "#ef4444",
      success: (res) => {
        if (res.confirm && work._id) onDelete(work._id);
      },
    });
  };

  return (
    <View className="work-card">
      {work.mediaUrl && work.mediaType === "image" && (
        <Image
          className="work-card__cover"
          src={work.mediaUrl}
          mode="aspectFill"
          onClick={() =>
            Taro.previewImage({
              urls: [work.mediaUrl as string],
              current: work.mediaUrl as string,
            })
          }
        />
      )}
      <View className="work-card__actions">
        <View className="work-card__action-delete" onClick={handleDelete}>
          🗑
        </View>
        <Button className="work-card__action-share" openType="share">
          📤
        </Button>
      </View>

      <View className="work-card__body">
        <View className="work-card__title-row">
          <Text className="work-card__title">{work.title}</Text>
          <Text className="work-card__badge">
            {CATEGORY_LABEL[work.category]}
          </Text>
        </View>
        {work.content ? (
          <Text className="work-card__content">{work.content}</Text>
        ) : null}
      </View>
    </View>
  );
};

export default WorkCard;
