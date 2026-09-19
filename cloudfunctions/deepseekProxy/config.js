/**
 * 模型配置中心
 * - DEFAULT_CONFIGS：代码内置默认兜底，保证服务永不中断
 * - getActiveLLMConfig：优先读云数据库 system_configs（_id: llm_active）动态热更
 *
 * AI 能力统一走微信云开发（wxai，cloud.ai()），无需自有 Key：
 * - 生文：createModel('cloudbase') + generateText（hy3）
 * - 生图：createImageModel('hunyuan-image') + generateImage
 * 历史第三方供应商（GLM/阿里云百炼/DeepSeek 等）已下线清理，勿再加回
 */
const DEFAULT_CONFIGS = {
  activeProvider: "wxai",

  providers: {
    wxai: {
      // 微信云开发大模型 AI 能力（wx-server-sdk ≥4.0.1 cloud.ai()）
      // 官方内置、无需自有 Key，费用走小程序成长计划赠送资源包（仅含 hy3）
      protocol: "wxai",
      apiKey: "",
      baseURL: "",
      model: "hy3",
      temperature: 0.7,
      max_tokens: 2048,
    },
  },
};

/**
 * 获取最终生效的 LLM 配置：云数据库优先，失败静默回退默认值
 * 仅允许 DB 覆盖 activeProvider/temperature/max_tokens；
 * model 不允许覆盖（防止文档残留值把请求劫持到未开通模型导致挂起超时，
 * 2026-09-13 排障结论：生文模型统一写死 hy3）
 * @param {*} db 云数据库实例（cloud.database()）
 * @returns {{ activeProvider: string, baseURL: string, apiKey: string, model: string, temperature: number, max_tokens: number }}
 */
const OVERRIDABLE_KEYS = ["activeProvider", "temperature", "max_tokens"];

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
