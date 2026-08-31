// 云函数入口文件
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const axios = require("axios");

// DeepSeek API Key（platform.deepseek.com 获取）
const DEEPSEEK_API_KEY = "process.env.DEEPSEEK_API_KEY";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

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

/**
 * 请求 DeepSeek 对话接口
 * @param {Array<{role:string;content:string}>} messages
 */
async function requestDeepSeek(messages) {
  const res = await axios.post(
    DEEPSEEK_URL,
    {
      model: "deepseek-v4-flash",
      messages,
      temperature: 0.7,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      timeout: 30000,
    },
  );
  return res.data?.choices?.[0]?.message?.content || "";
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const messages = event.messages || [];

  try {
    // 0. 空消息防护
    if (!messages.length) {
      return { success: false, error: "没有可发送的消息内容" };
    }

    // 1. 提取最后一条用户提问做安全检测
    const userQuery = [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content;

    if (userQuery && !(await checkText(userQuery, OPENID))) {
      return {
        success: false,
        error: "提问内容包含不适宜词汇，请换个健康的提问方式哦 ✨",
      };
    }

    // 2. 请求 DeepSeek API
    const reply = await requestDeepSeek(messages);

    // 3. AI 回答安全检测
    if (reply && !(await checkText(reply, OPENID))) {
      return {
        success: false,
        error: "回答内容含不适宜信息，已自动拦截，请换个问题试试 ✨",
      };
    }

    return { success: true, reply };
  } catch (err) {
    console.error("deepseekProxy error:", err);
    return {
      success: false,
      error: "服务繁忙，请稍后再试",
    };
  }
};
