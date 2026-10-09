// 通用多模型 Agent 网关入口：前置审核 -> 动态配置 -> Agent 循环 -> 后置审核
// AI 能力使用 wx-server-sdk ≥4.0.1 的 cloud.ai()
// （旧 cloud.openapi.ai.callOpenAI 已下线，报 -604100 API not found）
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, timeout: 60000 });

const { getActiveLLMConfig } = require("./config");
const { runAgentLoop } = require("./core/agentRunner");
const { createLLM } = require("./core/framework/llm");
const { runPattern } = require("./patterns");
const { chunkMaterial } = require("./core/chunking");
const axios = require("axios");
const {
  recordRequest,
  isOverBudget,
  aggregateDaily,
  costOf,
} = require("./core/metrics");

/**
 * 自研框架开关：配置了网关环境变量（CB_GATEWAY_KEY/CB_GATEWAY_URL）即切换到
 * 手写 ReAct 循环（可观测 trace）；未配置时回退 SDK 托管循环，保证平滑上线
 */
const FRAMEWORK_ENABLED = !!(
  process.env.CB_GATEWAY_KEY && process.env.CB_GATEWAY_URL
);

/** 生图模型：文生图 / 图生图（i2i 需传垫图 base64） */
const T2I_MODEL = "HY-Image-3.0-Plus-4090-Tob-v1.0";
const I2I_MODEL = "HY-Image-v3.0-I2I-ToB-v1.0.1";

/** 个人材料单用户上限 */
const MATERIAL_LIMIT = 50;

/**
 * 个人学习资料入库：上限校验 → 长文本分块 → 写 knowledge_base（openid 隔离）
 * @returns {{success, error?, materialId?}}
 */
async function ingestMaterial({ title, text }, openid, db) {
  const cleanTitle = String(title || "").trim().slice(0, 30) || "我的学习资料";
  const cleanText = String(text || "").trim().slice(0, 3000);
  if (!cleanText) {
    return { success: false, error: "资料内容为空" };
  }
  try {
    const col = db.collection("knowledge_base");
    const countRes = await col.where({ openid, source: "user" }).count();
    const used = countRes.total || 0;
    if (used >= MATERIAL_LIMIT) {
      return {
        success: false,
        error: `个人资料库已满（${MATERIAL_LIMIT} 条），请先删除部分内容`,
      };
    }
    // 长文本分块入库（配额内尽量多存，检索命中可引用局部内容）
    const chunks = chunkMaterial(cleanText).slice(0, MATERIAL_LIMIT - used);
    let materialId = null;
    for (let i = 0; i < chunks.length; i++) {
      const addRes = await col.add({
        data: {
          type: "material",
          question:
            chunks.length > 1 ? `${cleanTitle}·第${i + 1}段` : cleanTitle,
          answer: chunks[i],
          parentTitle: chunks.length > 1 ? cleanTitle : undefined,
          tags: [],
          abilityIds: [],
          difficulty: 1,
          source: "user",
          openid,
          usageCount: 0,
          lastUsedAt: 0,
        },
      });
      if (i === 0) materialId = addRes._id;
    }
    return { success: true, materialId };
  } catch (err) {
    console.error("ingestMaterial error:", err);
    return { success: false, error: String(err.message || err) };
  }
}

/** 拍照识字：微信 OCR 识别图片印刷体文字 */
async function ocrPrintedText(fileID) {
  try {
    const res = await cloud.openapi.ocr.printedText({
      type: "photo",
      imgUrl: fileID,
    });
    const lines = (res.items || []).map((it) => it.text || "");
    return { success: lines.length > 0, text: lines.join("\n") };
  } catch (err) {
    console.error("ocr.printedText error:", err);
    return {
      success: false,
      error: "识别失败，请改用粘贴文本方式",
      detail: String(err?.message || err).slice(0, 120),
    };
  }
}

/**
 * 生图结果转存：混元返回的是 24h 有效期的临时签名 URL，过期即 403。
 * 趁签名有效立即拉取字节，转存到用户云存储返回永久 fileID。
 * 任何失败（测试环境无 uploadFile / 拉取超时）都返回 null，由调用方回退临时 URL。
 */
async function persistGeneratedImage(url, openid) {
  if (!url || typeof cloud.uploadFile !== "function") return null;
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 8000,
    });
    const upload = await cloud.uploadFile({
      cloudPath: `ai-images/${openid || "anon"}/${Date.now()}.png`,
      fileContent: Buffer.from(res.data),
    });
    return upload.fileID || null;
  } catch (err) {
    console.warn("生图转存失败，回退临时 URL:", err?.message || err);
    return null;
  }
}

/** 生图：经 cloud.ai() 混元生图模型，按模式分发 t2i / i2i，结果转存云存储 */
async function generateImage({ prompt, mode, imageBase64 }, openid) {
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
    if (!url) {
      return { success: false, error: "生图失败，请稍后再试" };
    }
    const fileID = await persistGeneratedImage(url, openid);
    return {
      success: true,
      url,
      fileID,
      model: target,
      mode: isI2I ? "i2i" : "t2i",
    };
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
  const db = cloud.database();

  // 个人学习资料入库：event.type === 'ingest'
  if (event.type === "ingest") {
    const userQuery = `${event.title || ""}${event.text || ""}`.slice(0, 200);
    if (!(await checkText(userQuery, OPENID))) {
      return { success: false, error: "资料内容包含不适宜词汇，请修改后重试" };
    }
    const res = await ingestMaterial(
      { title: event.title, text: event.text },
      OPENID,
      db,
    );
    return res;
  }

  // 拍照识字：event.type === 'ocr'
  if (event.type === "ocr") {
    if (!event.fileID) {
      return { success: false, error: "缺少图片" };
    }
    const res = await ocrPrintedText(event.fileID);
    return { success: res.success, text: res.text || "", error: res.error || "" };
  }

  // 知识库随机抽题（首页灵感池）：event.type === 'kb_random'
  if (event.type === "kb_random") {
    const n = Math.min(Math.max(Number(event.count) || 2, 1), 5);
    const type = ["quiz", "mission"].includes(event.docType)
      ? event.docType
      : "quiz";
    try {
      const res = await db
        .collection("knowledge_base")
        .where({ type })
        .aggregate()
        .sample({ size: n })
        .end();
      const items = (res.list || []).map((d) => ({
        question: d.question,
        tags: d.tags || [],
      }));
      return { success: items.length > 0, items };
    } catch (err) {
      console.error("kb_random error:", err);
      return { success: false, items: [] };
    }
  }

  // 日聚合与告警（定时触发器或管理端手动触发；event.type === 'metrics_daily'）
  if (event.type === "metrics_daily") {
    try {
      const result = await aggregateDaily(db, event.day);
      return { success: true, ...result };
    } catch (err) {
      console.error("metrics_daily error:", err);
      return { success: false, error: String(err?.message || err).slice(0, 160) };
    }
  }

  // 生图独立请求：event.type === 'image'（mode: t2i 文生图 / i2i 图生图）
  if (event.type === "image") {
    const imgRes = await generateImage(
      {
        prompt: event.prompt,
        mode: event.mode,
        imageBase64: event.imageBase64,
      },
      OPENID,
    );
    return {
      success: imgRes.success,
      reply: imgRes.error || "",
      // 优先返回永久 fileID（转存成功）；失败回退临时 URL（24h 有效）
      imageUrl: imgRes.fileID || imgRes.url,
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

    // 2.5 成本护栏：单用户单日 token 预算超限 → 降级短回复（不再调用模型）
    if (await isOverBudget(db, OPENID)) {
      return {
        success: true,
        reply:
          "今天我们一起探索了好多内容，我的「能量」暂时用完啦 🌙 明天再来找我继续聊，好吗？",
        modelUsed: activeConfig.model,
        provider: activeConfig.activeProvider,
        executedTools: [],
        pattern: "budget-limited",
      };
    }

    // 3. 委派给 Agent 循环（Function Calling 自主决策）
    //    自研框架（手写循环 + trace）优先，event.pattern 可选推理范式；
    //    网关未配置时回退 SDK 托管循环（createLLM 仅在框架分支构建——
    //    本地测试/未配网关环境走 SDK 分支不受影响）
    const agentConfig = { ...activeConfig, webSearch: !!event.webSearch };
    const startedAt = Date.now();
    const llm = FRAMEWORK_ENABLED
      ? createLLM({
          apiKey: process.env.CB_GATEWAY_KEY,
          baseURL: process.env.CB_GATEWAY_URL,
          model: activeConfig.model,
        })
      : null;
    const agentResult = FRAMEWORK_ENABLED
      ? await runPattern(event.pattern, {
          messages,
          config: agentConfig,
          db,
          openid: OPENID,
          llm,
        })
      : await runAgentLoop({
          messages,
          config: agentConfig,
          db,
          openid: OPENID,
          cloud,
        });
    const { reply, executedTools, trace } = agentResult;

    // 3.5 可观测性与成本落库（fire-and-forget：失败静默，不影响响应）
    //     采集：耗时/步数/工具错误/降级/usage tokens/成本/预算护栏
    const toolErrors = executedTools.filter(
      (t) => t.result && t.result.success === false,
    ).length;
    const degraded = (trace || []).some(
      (t) =>
        typeof t.observation === "string" &&
        t.observation.includes("知识库暂无相关内容"),
    );
    const budgetExceeded = await isOverBudget(db, OPENID);
    const usage = (llm && llm.usage) || {};
    recordRequest(db, {
      openid: OPENID,
      pattern: event.pattern || "react",
      framework: FRAMEWORK_ENABLED ? "self" : "sdk",
      durationMs: Date.now() - startedAt,
      steps: (trace || []).length,
      llmCalls: usage.calls || 0,
      toolCalls: (executedTools || []).length,
      toolErrors,
      degraded,
      promptTokens: usage.promptTokens || 0,
      completionTokens: usage.completionTokens || 0,
      costYuan: costOf(activeConfig.model, usage.promptTokens || 0, usage.completionTokens || 0),
      budgetExceeded,
      model: activeConfig.model,
    }).catch(() => {});

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
      pattern: FRAMEWORK_ENABLED ? (event.pattern || "react") : "sdk-loop",
      // 自研框架链路附带 ReAct trace（thought/action/observation/durationMs）
      ...(trace ? { trace } : {}),
    };
  } catch (err) {
    console.error("deepseekProxy error:", err);
    const detail = String(err?.message || err);
    // 超时=模型未开通/无额度；429=免费套餐 QPS 限流（已自动重试一次）
    const hint = /timeout|timed out|ETIMEDOUT/i.test(detail)
      ? "（模型响应超时，请确认已开通该模型或稍后再试）"
      : /\b429\b|rate.?limit/i.test(detail)
        ? "（提问太频繁啦，休息几秒再试试 ✨）"
        : "";
    return {
      success: false,
      error: `服务繁忙，请稍后再试${hint}`,
      // 诊断用：截断携带失败详情，配合云函数日志定位云上调用问题
      errorDetail: detail.slice(0, 160),
    };
  }
};
