import Taro from "@tarojs/taro";

/** 学习小结（learning_digests 集合文档，由 Agent summarize_session 工具归档） */
export interface LearningDigest {
  _id?: string;
  summary: string;
  topics: string[];
  createdAt: number;
}

const db = () => Taro.cloud.database();

/** 读取最近一条学习小结（失败返回 null，调用方降级隐藏卡片） */
export async function getLatestDigest(): Promise<LearningDigest | null> {
  if (!Taro.cloud || !Taro.cloud.database) return null;
  try {
    const res = await db()
      .collection("learning_digests")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    return ((res.data || []) as LearningDigest[])[0] || null;
  } catch (err) {
    console.warn("learning_digests 读取失败:", err);
    return null;
  }
}
