/**
 * 多模型配置中心
 * - DEFAULT_CONFIGS：代码内置默认兜底，保证服务永不中断
 * - getActiveLLMConfig：优先读云数据库 system_configs（_id: llm_active）动态热更
 */
const DEFAULT_CONFIGS = {
  // 当前激活的供应商（默认 wxai 微信云开发 AI 能力，官方内置无需自有 Key）
  activeProvider: "wxai",

  // 预设供应商列表（均兼容 OpenAI 规范）
  providers: {
    wxai: {
      // 微信云开发大模型 AI 能力（wx-server-sdk ≥4.0.1 cloud.ai()，无需自有 Key）
      // 官方内置、费用走云开发资源点套餐
      protocol: "wxai",
      apiKey: "",
      baseURL: "",
      model: "hy3", // 成长计划免费包唯一可用生文模型（hy4-preview 需资源点套餐）
      temperature: 0.7,
      max_tokens: 2048,
    },
    glm: {
      // 智谱 BigModel（GLM-5.3-flash，支持 1M 上下文）
      // 密钥不硬编码：在云开发控制台为 deepseekProxy 配置 GLM_API_KEY 环境变量
      apiKey: process.env.GLM_API_KEY ?? "",
      baseURL: "https://open.bigmodel.cn/api/paas/v4",
      model: "glm-5.3-flash",
      temperature: 1,
      top_p: 0.95,
      max_tokens: 2048,
    },
    aliyun: {
      // 阿里云百炼 MaaS（OpenAI 兼容端点）
      // 密钥不硬编码：在云开发控制台为 deepseekProxy 配置 ALIYUN_API_KEY 环境变量
      apiKey: process.env.ALIYUN_API_KEY ?? "",
      baseURL:
        "https://llm-mxpx4kx94pkq771r.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
      model: "deepseek-v4-flash-0731", // 精确 id（GET /models 清单确认，全小写）
      temperature: 0.7,
      max_tokens: 2048,
    },
    aliyunAnthropic: {
      // 阿里云百炼 Anthropic 兼容端点
      // 密钥不硬编码：在云开发控制台为 deepseekProxy 配置 ALIYUN_API_KEY 环境变量
      apiKey: process.env.ALIYUN_API_KEY ?? "",
      baseURL:
        "https://llm-mxpx4kx94pkq771r.cn-beijing.maas.aliyuncs.com/apps/anthropic",
      protocol: "anthropic",
      model: "deepseek-v4-flash-0731",
      temperature: 0.7,
      max_tokens: 2048,
    },
    deepseek: {
      // 密钥不硬编码：在云开发控制台为 deepseekProxy 配置 DEEPSEEK_API_KEY 环境变量
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      baseURL: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      temperature: 0.7,
      max_tokens: 2048,
    },
    openai: {
      apiKey: "",
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 2048,
    },
    openrouter: {
      // 聚合网关：支持 Claude / Gemini / Llama 等任意国际模型
      apiKey: "",
      baseURL: "https://openrouter.ai/api/v1",
      model: "anthropic/claude-3.5-haiku",
      temperature: 0.7,
      max_tokens: 2048,
    },
    siliconflow: {
      // 硅基流动：托管 Qwen2.5、DeepSeek-V3 等
      apiKey: "",
      baseURL: "https://api.siliconflow.cn/v1",
      model: "deepseek-ai/DeepSeek-V3",
      temperature: 0.7,
      max_tokens: 2048,
    },
    qwen: {
      apiKey: "",
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-turbo",
      temperature: 0.7,
      max_tokens: 2048,
    },
    kimi: {
      apiKey: "",
      baseURL: "https://api.moonshot.cn/v1",
      model: "moonshot-v1-8k",
      temperature: 0.7,
      max_tokens: 2048,
    },
  },
};

/**
 * 获取最终生效的 LLM 配置：云数据库优先，失败静默回退默认值
 * 仅允许 DB 覆盖白名单字段（activeProvider/model/temperature/max_tokens），
 * 防止文档残留的 apiKey/baseURL 把请求劫持到失效供应商（2026-09-12 排障结论）
 * @param {*} db 云数据库实例（cloud.database()）
 * @returns {{ activeProvider: string, baseURL: string, apiKey: string, model: string, temperature: number, max_tokens: number }}
 */
const OVERRIDABLE_KEYS = [
  "activeProvider",
  "model",
  "temperature",
  "max_tokens",
];

async function getActiveLLMConfig(db) {
  try {
    const res = await db.collection("system_configs").doc("llm_active").get();
    const raw = res.data || {};
    const overrides = {};
    for (const key of OVERRIDABLE_KEYS) {
      if (raw[key] !== undefined) overrides[key] = raw[key];
    }
    const activeProvider =
      overrides.activeProvider || DEFAULT_CONFIGS.activeProvider;
    const base =
      DEFAULT_CONFIGS.providers[activeProvider] ||
      DEFAULT_CONFIGS.providers[DEFAULT_CONFIGS.activeProvider];
    return {
      activeProvider,
      ...base,
      ...overrides,
    };
  } catch (err) {
    console.warn("system_configs 读取失败，使用默认配置:", err.message || err);
    const base = DEFAULT_CONFIGS.providers[DEFAULT_CONFIGS.activeProvider];
    return { activeProvider: DEFAULT_CONFIGS.activeProvider, ...base };
  }
}

module.exports = { DEFAULT_CONFIGS, getActiveLLMConfig };
