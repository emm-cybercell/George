import Taro from "@tarojs/taro";

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
      success: (res) => resolve(res.data),
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
