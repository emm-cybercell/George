import { View, Text } from "@tarojs/components";
import type { ReactNode } from "react";
import "./index.scss";

interface InfoCardProps {
  badge?: string;
  title: string;
  desc?: string;
  icon?: string;
  tags?: string[];
  children?: ReactNode;
}

const InfoCard = ({
  badge,
  title,
  desc,
  icon,
  tags,
  children,
}: InfoCardProps) => {
  return (
    <View className="info-card">
      {badge ? <Text className="info-card__badge">{badge}</Text> : null}
      {icon ? <Text className="info-card__feature-icon">{icon}</Text> : null}
      <Text className="info-card__title">{title}</Text>
      {desc ? <Text className="info-card__desc">{desc}</Text> : null}
      {tags?.length ? (
        <View className="info-card__tags">
          {tags.map((tag) => (
            <Text className="info-card__tag" key={tag}>
              {tag}
            </Text>
          ))}
        </View>
      ) : null}
      {children}
    </View>
  );
};

export default InfoCard;
