// 通用多模型 Agent 网关入口：前置审核 -> 动态配置 -> Agent 循环 -> 后置审核
// AI 能力使用 wx-server-sdk ≥4.0.1 的 cloud.ai()
// （旧 cloud.openapi.ai.callOpenAI 已下线，报 -604100 API not found）
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, timeout: 60000 });

const { getActiveLLMConfig } = require("./config");
const { runAgentLoop } = require("./core/agentRunner");

/** 生图模型：文生图 / 图生图（i2i 需传垫图 base64） */
const T2I_MODEL = "HY-Image-3.0-Plus-4090-Tob-v1.0";
const I2I_MODEL = "HY-Image-v3.0-I2I-ToB-v1.0.1";

/** 生图：经 cloud.ai() 混元生图模型，按模式分发 t2i / i2i */
async function generateImage({ prompt, mode, imageBase64 }) {
  const content = String(prompt || "").trim();
  if (!content) {
    return { success: false, error: "请输入生图描述" };
  }
  const isI2I = mode === "i2i";
  if (isI2I && !imageBase64) {
    return { success: false, error: "请先选择参考图片" };
  }
  const target = isI2I ? I2I_MODEL : T2I_MODEL;
  try {
    const imageModel = cloud.ai().createImageModel("hunyuan-image");
    const res = await imageModel.generateImage({
      model: target,
      prompt: content,
      ...(isI2I
        ? { images: [imageBase64] }
        : { size: "1024x1024" }),
    });
    const url = res?.data?.[0]?.url || "";
    return { success: !!url, url, model: target, mode: isI2I ? "i2i" : "t2i" };
  } catch (err) {
    console.error("generateImage error:", err);
    return {
      success: false,
      error: "生图失败，请稍后再试",
      detail: String(err?.message || err).slice(0, 160),
    };
  }
}

/**
 * 安全审核：通过微信内容安全接口校验文本
 * @returns {boolean} true=通过
 */
async function checkText(content, openid) {
  if (!content) return true;
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      content: content, // 2.0 版本传 content 字符串
      version: 2,
      scene: 2,
      openid: openid,
    });
    return res.errCode === 0;
  } catch (err) {
    // 审核接口异常时放行，避免误伤正常提问
    console.warn("msgSecCheck error:", err);
    return true;
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  // 生图独立请求：event.type === 'image'（mode: t2i 文生图 / i2i 图生图）
  if (event.type === "image") {
    const imgRes = await generateImage({
      prompt: event.prompt,
      mode: event.mode,
      imageBase64: event.imageBase64,
    });
    return {
      success: imgRes.success,
      reply: imgRes.error || "",
      imageUrl: imgRes.url,
      modelUsed: imgRes.model,
      provider: "wxai-image",
    };
  }

  const messages = event.messages || [];

  try {
    // 0. 空消息防护
    if (!messages.length) {
      return { success: false, error: "没有可发送的消息内容" };
    }

    // 1. 前置内容安全审查：用户最新提问
    const userQuery = [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content;

    if (userQuery && !(await checkText(userQuery, OPENID))) {
      return {
        success: false,
        error: "提问内容包含不适宜词汇，请换个健康的提问方式哦 ✨",
      };
    }

    // 2. 读取最终生效的模型配置（代码默认兜底 + system_configs 动态热更）
    const activeConfig = await getActiveLLMConfig(cloud.database());

    // 3. 委派给 ReAct Agent 循环（Function Calling 自主决策）
    const { reply, executedTools } = await runAgentLoop({
      messages,
      config: activeConfig,
      db: cloud.database(),
      openid: OPENID,
      cloud,
    });

    // 4. 后置内容安全审查：AI 生成的回答
    if (reply && !(await checkText(reply, OPENID))) {
      return {
        success: false,
        error: "回答内容含不适宜信息，已自动拦截，请换个问题试试 ✨",
      };
    }

    // 5. 响应输出（保持前端协议兼容：success / reply / error + 工具清单）
    return {
      success: true,
      reply,
      modelUsed: activeConfig.model,
      provider: activeConfig.activeProvider,
      executedTools,
    };
  } catch (err) {
    console.error("deepseekProxy error:", err);
    const detail = String(err?.message || err);
    // 超时多为所选模型在当前环境未开通/无额度（成长计划免费包仅含 hy3），提示可切换
    const hint = /timeout|timed out|ETIMEDOUT/i.test(detail)
      ? "（当前模型响应超时，可能是未开通该模型，可在「+ → 切换对话模型」换 hy3）"
      : "";
    return {
      success: false,
      error: `服务繁忙，请稍后再试${hint}`,
      // 诊断用：截断携带失败详情，配合云函数日志定位云上调用问题
      errorDetail: detail.slice(0, 160),
    };
  }
};
