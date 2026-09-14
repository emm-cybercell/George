import Taro from "@tarojs/taro";

/** 个人学习材料（knowledge_base 中 source:"user" 的文档） */
export interface MyMaterial {
  _id?: string;
  question: string;
  answer: string;
  usageCount?: number;
}

const db = () => Taro.cloud.database();

/** 拍照识字：上传图片到云存储后调 OCR */
export async function recognizeImage(
  tempFilePath: string,
): Promise<{ success: boolean; text: string; error?: string }> {
  try {
    Taro.showLoading({ title: "上传图片中..." });
    const upload = await Taro.cloud.uploadFile({
      cloudPath: `ocr/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`,
      filePath: tempFilePath,
    });
    Taro.hideLoading();
    Taro.showLoading({ title: "识别文字中..." });
    const res = await Taro.cloud.callFunction({
      name: "deepseekProxy",
      data: { type: "ocr", fileID: upload.fileID },
    });
    Taro.hideLoading();
    const result = res.result as { success: boolean; text: string; error?: string };
    return {
      success: !!result.success,
      text: result.text || "",
      error: result.error,
    };
  } catch (err) {
    Taro.hideLoading();
    console.error("OCR 调用失败:", err);
    return { success: false, text: "", error: "识别服务异常，请改用粘贴文本" };
  }
}

/** 学习资料入库（云函数侧做审核与上限校验） */
export async function ingestMaterial(
  title: string,
  text: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await Taro.cloud.callFunction({
      name: "deepseekProxy",
      data: { type: "ingest", title, text },
    });
    const result = res.result as { success: boolean; error?: string };
    return { success: !!result.success, error: result.error };
  } catch (err) {
    console.error("资料入库失败:", err);
    return { success: false, error: "网络异常，请稍后重试" };
  }
}

/** 我的材料列表（倒序 50 条） */
export async function listMyMaterials(): Promise<MyMaterial[]> {
  if (!Taro.cloud || !Taro.cloud.database) return [];
  try {
    const res = await db()
      .collection("knowledge_base")
      .where({ source: "user" })
      .orderBy("lastUsedAt", "desc")
      .limit(50)
      .get();
    return (res.data || []) as MyMaterial[];
  } catch (err) {
    console.warn("我的材料读取失败:", err);
    return [];
  }
}

/** 删除我的材料（仅创建者可删，权限由集合规则保证） */
export async function deleteMyMaterial(id: string): Promise<void> {
  if (!Taro.cloud || !Taro.cloud.database || !id) return;
  try {
    await db().collection("knowledge_base").doc(id).remove({});
  } catch (err) {
    console.warn("材料删除失败:", err);
  }
}

/** 本地灵感兜底池 */
const LOCAL_INSPIRATIONS = [
  "🤖 如果火星上有学校，操场会是什么样子？",
  "🎨 怎么写魔法指令让 AI 画一只赛博朋克小猫？",
  "🚀 如果我能给太阳写信，第一句话会写什么？",
  "🌌 星星之间也有交通红绿灯吗？",
  "🧬 发明一台能闻到梦想的机器，需要哪些零件？",
  "🦕 如果恐龙会编程，它们会建什么样的城市？",
];

/** 本地池随机取 n 条（去重） */
export function pickLocal(n: number): string[] {
  const pool = [...LOCAL_INSPIRATIONS];
  const picks: string[] = [];
  while (picks.length < n && pool.length > 0) {
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picks;
}

/** 知识库随机抽题（失败返回空数组，调用方降级本地池） */
export async function pickFromKB(n: number): Promise<string[]> {
  try {
    const res = await Taro.cloud.callFunction({
      name: "deepseekProxy",
      data: { type: "kb_random", docType: "quiz", count: n },
    });
    const result = res.result as {
      success: boolean;
      items: Array<{ question: string }>;
    };
    if (!result?.success || !result.items?.length) return [];
    return result.items.map((it) => it.question);
  } catch (err) {
    console.warn("灵感池云端抽取失败:", err);
    return [];
  }
}
