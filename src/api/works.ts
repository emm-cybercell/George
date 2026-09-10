import Taro from "@tarojs/taro";
import type { CreativeWork } from "@/types";

const db = () => Taro.cloud.database();

/** 云能力是否可用 */
function cloudReady(): boolean {
  return !!Taro.cloud && !!Taro.cloud.uploadFile && !!Taro.cloud.database;
}

/**
 * 上传本地媒体文件至云存储。
 * @param tempFilePath 本地临时文件路径
 * @param folder 存储目录（images / works）
 * @returns 云端 fileID（cloud://...）
 */
export async function uploadMediaToCloud(
  tempFilePath: string,
  folder: "images" | "works",
): Promise<string> {
  if (!cloudReady()) {
    throw new Error("云能力不可用");
  }
  const ext = tempFilePath.includes(".")
    ? tempFilePath.slice(tempFilePath.lastIndexOf("."))
    : ".png";
  const cloudPath = `${folder}/${Date.now()}_${Math.random()
    .toString(36)
    .slice(-4)}${ext}`;
  const res = await Taro.cloud.uploadFile({
    cloudPath,
    filePath: tempFilePath,
  });
  return res.fileID;
}

/** 作品写入云端（失败静默，本地预览由页面兜底） */
export async function saveCreativeWork(
  work: Omit<CreativeWork, "createTime" | "_id" | "_openid">,
): Promise<void> {
  if (!cloudReady()) return;
  try {
    await db()
      .collection("creative_works")
      .add({ data: { ...work, createTime: Date.now() } });
  } catch (err) {
    console.warn("creative_works 云端写入失败:", err);
  }
}

/** 查询云端作品（倒序取前 50 条） */
export async function queryCreativeWorks(): Promise<CreativeWork[]> {
  if (!cloudReady()) return [];
  try {
    const res = await db()
      .collection("creative_works")
      .orderBy("createTime", "desc")
      .limit(50)
      .get();
    return (res.data || []) as CreativeWork[];
  } catch (err) {
    console.warn("creative_works 云端读取失败:", err);
    return [];
  }
}

/** 删除单条作品（失败静默） */
export async function deleteCreativeWork(id: string): Promise<void> {
  if (!cloudReady() || !id) return;
  try {
    await db().collection("creative_works").doc(id).remove({});
  } catch (err) {
    console.warn("creative_works 云端删除失败:", err);
  }
}
