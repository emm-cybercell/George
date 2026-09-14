import { useState } from "react";
import { View, Text, Input, Textarea, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import {
  deleteMyMaterial,
  ingestMaterial,
  listMyMaterials,
  recognizeImage,
  type MyMaterial,
} from "@/api/knowledge";
import "./index.scss";

interface MaterialPanelProps {
  visible: boolean;
  onClose: () => void;
}

type TabKey = "add" | "list";

/** 个人学习资料库面板：拍照识字 / 粘贴文本 / 我的材料管理 */
const MaterialPanel = ({ visible, onClose }: MaterialPanelProps) => {
  const [tab, setTab] = useState<TabKey>("add");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [materials, setMaterials] = useState<MyMaterial[]>([]);
  const [listLoaded, setListLoaded] = useState(false);

  if (!visible) return null;

  /** 拍照识字 → 文本进编辑框 */
  const handleCamera = async () => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["camera", "album"],
        sizeType: ["compressed"],
      });
      const ocr = await recognizeImage(res.tempFiles[0].tempFilePath);
      if (ocr.success && ocr.text) {
        setText((prev) => (prev ? `${prev}\n${ocr.text}` : ocr.text));
        Taro.showToast({ title: "识别成功，请校对文字", icon: "none" });
      } else {
        Taro.showToast({ title: ocr.error || "未识别到文字", icon: "none" });
      }
    } catch (err) {
      const msg = (err as { errMsg?: string })?.errMsg || "";
      if (!msg.includes("cancel")) {
        Taro.showToast({ title: "图片获取失败", icon: "none" });
      }
    }
  };

  /** 提交入库 */
  const handleSubmit = async () => {
    if (!text.trim()) {
      Taro.showToast({ title: "请先输入或识别资料内容", icon: "none" });
      return;
    }
    setSubmitting(true);
    const res = await ingestMaterial(title.trim(), text.trim());
    setSubmitting(false);
    if (res.success) {
      Taro.showToast({ title: "已存入我的资料库 📚", icon: "success" });
      setTitle("");
      setText("");
      setListLoaded(false);
    } else {
      Taro.showToast({ title: res.error || "保存失败，请重试", icon: "none" });
    }
  };

  /** 加载我的材料 */
  const loadList = async () => {
    if (listLoaded) return;
    setMaterials(await listMyMaterials());
    setListLoaded(true);
  };

  const switchTab = (key: TabKey) => {
    setTab(key);
    if (key === "list") loadList();
  };

  const handleDelete = (id: string) => {
    Taro.showModal({
      title: "删除资料",
      content: "确定删除这条学习资料吗？",
      confirmColor: "#ef4444",
      success: async (res) => {
        if (!res.confirm) return;
        await deleteMyMaterial(id);
        setMaterials((list) => list.filter((m) => m._id !== id));
      },
    });
  };

  return (
    <View className="mat-panel">
      <View className="mat-panel__mask" onClick={onClose} />
      <View className="mat-panel__card">
        <Text className="mat-panel__title">📚 我的资料库</Text>

        <View className="mat-panel__tabs">
          <View
            className={`mat-panel__tab ${tab === "add" ? "mat-panel__tab--active" : ""}`}
            onClick={() => switchTab("add")}
          >
            <Text>存入资料</Text>
          </View>
          <View
            className={`mat-panel__tab ${tab === "list" ? "mat-panel__tab--active" : ""}`}
            onClick={() => switchTab("list")}
          >
            <Text>我的材料</Text>
          </View>
        </View>

        <ScrollView scrollY className="mat-panel__scroll">
          {tab === "add" ? (
            <View className="mat-panel__form">
              <View className="mat-panel__camera" onClick={handleCamera}>
                <Text>📷 拍照识字（教材 / 习题）</Text>
              </View>
              <Input
                className="mat-panel__input"
                value={title}
                onInput={(e) => setTitle(e.detail.value)}
                placeholder="资料标题（如：六年级数学第三单元）"
                maxlength={30}
              />
              <Textarea
                className="mat-panel__textarea"
                value={text}
                onInput={(e) => setText(e.detail.value)}
                placeholder="粘贴或识别出的资料内容，AI 对话时会优先参考"
                maxlength={3000}
              />
              <View
                className={`mat-panel__go ${submitting ? "mat-panel__go--busy" : ""}`}
                onClick={() => !submitting && handleSubmit()}
              >
                {submitting ? "保存中…" : "📚 存入资料库"}
              </View>
            </View>
          ) : (
            <View className="mat-panel__list">
              {materials.length === 0 ? (
                <Text className="mat-panel__empty">
                  还没有材料，先去「存入资料」吧
                </Text>
              ) : (
                materials.map((m) => (
                  <View key={m._id} className="mat-panel__item">
                    <View className="mat-panel__item-main">
                      <Text className="mat-panel__item-title">{m.question}</Text>
                      <Text className="mat-panel__item-sub">
                        {String(m.answer).slice(0, 40)}…
                      </Text>
                    </View>
                    <Text
                      className="mat-panel__item-del"
                      onClick={() => m._id && handleDelete(m._id)}
                    >
                      🗑
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>

        <View className="mat-panel__cancel" onClick={onClose}>
          取消
        </View>
      </View>
    </View>
  );
};

export default MaterialPanel;
