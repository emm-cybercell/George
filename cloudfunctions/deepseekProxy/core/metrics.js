/**
 * Agent 可观测性与成本控制
 * - 请求级落库：agent_metrics 集合（异步写、失败静默——观测不能拖累主链路）
 *   { openid, pattern, durationMs, steps, llmCalls, toolCalls, toolErrors,
 *     degraded, promptTokens, completionTokens, costYuan, budgetExceeded, timestamp }
 * - 成本核算：网关 usage tokens × 模型单价（hy3 免费资源包期间记 0，单价改 DB 即生效）
 * - 预算护栏：单用户单日 token 上限（rate_limit 思路：日桶计数器），超限降级短回复
 * - 日聚合：aggregateDaily 汇总 agent_metrics → metrics_daily（QPS/P95/错误率/降级率/成本）
 *   超阈值写入告警文档 metrics_alerts（推送渠道可后接 webhook/订阅消息）
 */
const METRICS_COLLECTION = "agent_metrics";
const DAILY_COLLECTION = "metrics_daily";
const ALERT_COLLECTION = "metrics_alerts";

/** 模型单价（元 / 1K tokens）；hy3 走小程序成长计划免费资源包，记 0 */
const MODEL_PRICE = {
  "hy3": { prompt: 0, completion: 0 },
};
/** 单用户单日 completion token 预算（护栏，超限降级短回复） */
const DAILY_TOKEN_BUDGET = 20000;
/** 告警阈值 */
const ALERT_RULES = {
  errorRate: 0.2, // 工具/请求错误率 >20%
  degradedRate: 0.3, // 降级触发率 >30%
  p95Ms: 45000, // P95 延迟 >45s（逼近云函数上限）
};

/** 北京时区 YYYY-MM-DD（云函数运行在 UTC，加 8h 再取日期） */
function dayOf(ts = Date.now()) {
  const d = new Date(ts + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/** tokens → 元（未收录模型按 0 计） */
function costOf(model, promptTokens, completionTokens) {
  const p = MODEL_PRICE[model];
  if (!p) return 0;
  return (
    (promptTokens * p.prompt + completionTokens * p.completion) / 1000
  );
}

/** 失败静默写：观测写入永不影响主链路（await 交由调用方 fire-and-forget） */
async function recordRequest(db, doc) {
  try {
    await db.collection(METRICS_COLLECTION).add({
      data: { ...doc, day: dayOf(), timestamp: Date.now() },
    });
  } catch (err) {
    console.warn("agent_metrics 落库失败:", err.message || err);
  }
}

/**
 * 单用户单日 token 预算检查（超限返回 true，调用方降级为短回复/拒答）
 * 计数器文档：budget_daily_{day}_{openid}；DB 故障视为未超限（可用性优先）
 */
async function isOverBudget(db, openid) {
  if (!db || !openid) return false;
  const id = `budget_daily_${dayOf()}_${openid}`;
  try {
    const res = await db.collection(METRICS_COLLECTION).doc(id).get();
    const used = Number(res.data?.completionTokens || 0);
    return used >= DAILY_TOKEN_BUDGET;
  } catch {
    return false; // 文档不存在（当日首次）或读失败：未超限
  }
}

/**
 * P95（请求级毫秒数组 → 分位值；简单最近邻取法，样本量级下足够）
 */
function percentile95(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

/**
 * 日聚合：汇总当天 agent_metrics → metrics_daily，超阈值写 metrics_alerts
 * 由定时触发器每日调用；也支持手动触发补算
 */
async function aggregateDaily(db, day = dayOf()) {
  const BATCH = 100;
  let skip = 0;
  let total = 0;
  let errors = 0;
  let degraded = 0;
  let budgetExceeded = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let cost = 0;
  const durations = [];

  for (let page = 0; page < 100; page++) {
    const res = await db
      .collection(METRICS_COLLECTION)
      .where({ day })
      .skip(skip)
      .limit(BATCH)
      .get();
    const batch = res.data || [];
    if (!batch.length) break;
    for (const m of batch) {
      total += 1;
      if (m.toolErrors > 0) errors += 1;
      if (m.degraded) degraded += 1;
      if (m.budgetExceeded) budgetExceeded += 1;
      promptTokens += Number(m.promptTokens) || 0;
      completionTokens += Number(m.completionTokens) || 0;
      cost += Number(m.costYuan) || 0;
      durations.push(Number(m.durationMs) || 0);
    }
    skip += batch.length;
    if (batch.length < BATCH) break;
  }

  const summary = {
    day,
    total,
    errorRate: total ? +(errors / total).toFixed(3) : 0,
    degradedRate: total ? +(degraded / total).toFixed(3) : 0,
    budgetExceeded,
    p95Ms: percentile95(durations),
    promptTokens,
    completionTokens,
    costYuan: +cost.toFixed(4),
    updatedAt: Date.now(),
  };

  // upsert 日汇总（读写竞态可接受：幂等重算覆盖）
  const id = `daily_${day}`;
  try {
    await db.collection(DAILY_COLLECTION).doc(id).set({ data: summary });
  } catch (err) {
    console.warn("metrics_daily 写入失败:", err.message || err);
  }

  // 阈值告警：命中规则的项逐条落告警文档（重复告警靠 day 前缀天然去重）
  const alerts = [];
  if (total >= 10) {
    // 样本太小不告警，防抖
    if (summary.errorRate > ALERT_RULES.errorRate)
      alerts.push(`错误率 ${(summary.errorRate * 100).toFixed(0)}% 超阈值 ${ALERT_RULES.errorRate * 100}%`);
    if (summary.degradedRate > ALERT_RULES.degradedRate)
      alerts.push(`降级率 ${(summary.degradedRate * 100).toFixed(0)}% 超阈值 ${ALERT_RULES.degradedRate * 100}%`);
    if (summary.p95Ms > ALERT_RULES.p95Ms)
      alerts.push(`P95 延迟 ${Math.round(summary.p95Ms / 1000)}s 超阈值 ${ALERT_RULES.p95Ms / 1000}s`);
  }
  for (const message of alerts) {
    try {
      await db.collection(ALERT_COLLECTION).add({
        data: { day, level: "warning", message, resolved: false, timestamp: Date.now() },
      });
    } catch (err) {
      console.warn("metrics_alerts 写入失败:", err.message || err);
    }
  }
  return { summary, alerts };
}

module.exports = {
  METRICS_COLLECTION,
  DAILY_COLLECTION,
  ALERT_COLLECTION,
  DAILY_TOKEN_BUDGET,
  costOf,
  dayOf,
  recordRequest,
  isOverBudget,
  aggregateDaily,
  percentile95,
};
