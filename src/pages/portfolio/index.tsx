import { useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useDidShow, useShareAppMessage } from "@tarojs/taro";
import WorkCard from "@/components/Portfolio/WorkCard";
import {
  deleteCreativeWork,
  queryCreativeWorks,
  saveCreativeWork,
  uploadMediaToCloud,
} from "@/api/works";
import type { CreativeWork } from "@/types";
import "./index.scss";

type FilterKey = "all" | "drawing" | "photo" | "stories" | "science";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "drawing", label: "🎨 绘本与画作" },
  { key: "photo", label: "📸 手工与实物" },
  { key: "stories", label: "📝 故事灵感" },
  { key: "science", label: "🔬 科学发现" },
];

const Portfolio = () => {
  const [works, setWorks] = useState<CreativeWork[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);

  useShareAppMessage(() => ({
    title: "我的创意作品集",
    path: "/pages/portfolio/index",
  }));

  // 页面展示时云优先拉取作品
  const refresh = async () => {
    setLoading(true);
    setWorks(await queryCreativeWorks());
    setLoading(false);
  };

  useDidShow(refresh);

  const filtered = works.filter((w) =>
    filter === "all"
      ? true
      : filter === "stories"
        ? w.category === "story" || w.category === "idea"
        : w.category === filter,
  );
  const handleDelete = async (id: string) => {
    await deleteCreativeWork(id);
    setWorks((list) => list.filter((w) => w._id !== id));
    Taro.showToast({ title: "已删除", icon: "none" });
  };

  // 悬浮按钮：从相册挑选画作直接存入画廊
  const handleAdd = async () => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album"],
      });
      Taro.showLoading({ title: "作品上传中..." });
      const fileID = await uploadMediaToCloud(
        res.tempFiles[0].tempFilePath,
        "works",
      );
      Taro.hideLoading();
      const now = new Date();
      await saveCreativeWork({
        title: `我的作品 ${now.getMonth() + 1}-${now.getDate()}`,
        category: "drawing",
        mediaType: "image",
        mediaUrl: fileID,
        content: "",
        abilityMode: "",
      });
      Taro.showToast({ title: "已存入作品集 ✨", icon: "success" });
      refresh();
    } catch (err) {
      Taro.hideLoading();
      // 用户取消选择不提示
      const msg = (err as { errMsg?: string })?.errMsg || "";
      if (!msg.includes("cancel")) {
        Taro.showToast({ title: "添加失败，请重试", icon: "none" });
      }
    }
  };

  return (
    <View className="portfolio">
      <View className="portfolio__header">
        <View className="portfolio__header-row">
          <View className="portfolio__back" onClick={() => Taro.navigateBack()}>
            ‹ 返回
          </View>
          <Text className="portfolio__title">创意作品集</Text>
        </View>
      </View>

      <View className="portfolio__filters">
        {FILTERS.map((f) => (
          <View
            key={f.key}
            className={`portfolio__filter ${
              filter === f.key ? "portfolio__filter--active" : ""
            }`}
            onClick={() => setFilter(f.key)}
          >
            <Text>{f.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView scrollY className="portfolio__list">
        <View className="portfolio__grid">
          {loading ? (
            [0, 1, 2].map((i) => (
              <View key={i} className="portfolio__skeleton" />
            ))
          ) : filtered.length === 0 ? (
            <Text className="portfolio__empty">
              还没有作品，点击右下角 + 存入第一件作品吧 ✨
            </Text>
          ) : (
            filtered.map((w) => (
              <WorkCard key={w._id} work={w} onDelete={handleDelete} />
            ))
          )}
        </View>
      </ScrollView>

      <View className="portfolio__fab" onClick={handleAdd}>
        ➕ 存入新作品
      </View>
    </View>
  );
};

export default Portfolio;
