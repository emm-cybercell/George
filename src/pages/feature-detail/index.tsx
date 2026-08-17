import { View, Text } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { useState } from "react";
import CustomPageHeader from "@/components/CustomPageHeader";
import { FEATURE_MAP, type FeatureDetail as DetailMeta } from "./data";
import "./index.scss";

const FeatureDetail = () => {
  const router = useRouter();
  const [type] = useState(router.params.type || "observation");
  const detail: DetailMeta = FEATURE_MAP[type] || FEATURE_MAP["observation"];
  const heroStyle = { background: detail.color };

  const handleAction = (action?: string) => {
    if (action === "start-lab" || action === "ask") {
      Taro.redirectTo({ url: "/pages/learn/index" });
    }
  };

  return (
    <View className="feature-detail">
      <CustomPageHeader title={detail.title} />

      <View className="feature-detail__body">
        <View className="feature-detail__hero card-animate" style={heroStyle}>
          <Text className="feature-detail__icon">{detail.icon}</Text>
          <Text className="feature-detail__title">{detail.title}</Text>
          <Text className="feature-detail__slogan">{detail.slogan}</Text>
        </View>

        {detail.sections.map((s) => (
          <View
            className="feature-detail__section card-animate"
            key={s.heading}
          >
            <Text className="feature-detail__heading">{s.heading}</Text>
            {s.items.map((item) => (
              <View
                className={`feature-detail__item ${
                  item.action ? "feature-detail__item--action" : ""
                }`}
                key={item.text}
                onClick={() => handleAction(item.action)}
              >
                <Text className="feature-detail__dot">•</Text>
                <Text className="feature-detail__text">{item.text}</Text>
                {item.action ? (
                  <Text className="feature-detail__go">›</Text>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

export default FeatureDetail;
