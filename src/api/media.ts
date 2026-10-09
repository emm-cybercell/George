/**
 * 媒体域 API（合并模块）：AI 生图 / 云存储上传 / 作品集存取
 * - generateImage：云函数混元生图（结果已由云函数转存为永久 cloud:// fileID）
 * - uploadMediaToCloud：本地临时文件 → 云存储（作品图片/头像共用）
 * - saveCreativeWork / fetchWorks / deleteWork：作品集 CRUD（creative_works 集合）
 * 原 image.ts 与 works.ts 按媒体域内聚合并
 */
import Taro from "@tarojs/taro";
import type { CreativeWork } from "@/types";

export type ImageGenMode = "t2i" | "i2i";

export interface GenerateImageResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  modelUsed?: string;
}

/** 读取本地临时文件为 base64（图生图垫图，直传云函数不占云存储） */
export function fileToBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: "base64",
      success: (res) => resolve(String(res.data)),
      fail: reject,
    });
  });
}

/** 调云函数生图：t2i 文生图 / i2i 图生图（需传垫图 base64） */
export async function generateImage(opts: {
  prompt: string;
  mode: ImageGenMode;
  imageBase64?: string;
}): Promise<GenerateImageResult> {
  try {
    const res = await Taro.cloud.callFunction({
      name: "deepseekProxy",
      data: {
        type: "image",
        prompt: opts.prompt,
        mode: opts.mode,
        imageBase64: opts.imageBase64,
      },
    });
    const result = res.result as GenerateImageResult;
    if (result && result.success && result.imageUrl) {
      return result;
    }
    return {
      success: false,
      error: result?.error || "生图失败，请重试",
    };
  } catch (err) {
    console.error("生图云函数调用失败:", err);
    return { success: false, error: "网络异常，请稍后重试" };
  }
}

// ===== 云存储与作品集 =====

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
