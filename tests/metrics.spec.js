/**
 * 监控与成本模块单测（零外部依赖）
 * 覆盖：成本换算、P95 分位、日聚合统计与告警阈值、预算判断、落库静默失败
 * 运行：node --test tests/metrics.spec.js
 */
const test = require("node:test");
const assert = require("node:assert");
const {
  costOf,
  dayOf,
  percentile95,
  aggregateDaily,
  isOverBudget,
  recordRequest,
  DAILY_TOKEN_BUDGET,
} = require("../cloudfunctions/deepseekProxy/core/metrics");

/** 可注入脚本的 mock db：支持 collection().where/skip/limit/get、doc().get/set、add */
function mockDb({ docs = [], failAdd = false, budgetDoc = null, failGet = false } = {}) {
  const added = [];
  const setDocs = {};
  return {
    added,
    setDocs,
    collection: (name) => ({
      add: async ({ data }) => {
        if (failAdd) throw new Error("add failed");
        added.push({ name, data });
        return { _id: `id-${added.length}` };
      },
      where: () => ({
        skip: () => ({
          limit: () => ({
            get: async () => ({ data: docs }),
          }),
        }),
      }),
      limit: () => ({
        get: async () => {
          if (failGet) throw new Error("get failed");
          return { data: docs };
        },
      }),
      doc: (id) => ({
        get: async () => {
          if (failGet) throw new Error("get failed");
          // 预算文档按 id 前缀匹配返回
          if (id.startsWith("budget_daily_")) {
            return budgetDoc ? { data: budgetDoc } : { data: null };
          }
          return { data: null };
        },
        set: async ({ data }) => {
          setDocs[id] = data;
          return {};
        },
      }),
    }),
  };
}

test("costOf：按单价换算，未收录模型记 0", () => {
  assert.equal(costOf("hy3", 1000, 2000), 0); // 免费资源包单价 0
  assert.equal(costOf("unknown-model", 1000, 2000), 0);
});

test("dayOf：输出 YYYY-MM-DD 格式", () => {
  assert.match(dayOf(), /^\d{4}-\d{2}-\d{2}$/);
});

test("percentile95：空数组 0，常规分位取最近邻", () => {
  assert.equal(percentile95([]), 0);
  assert.equal(percentile95([100]), 100);
  const vals = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
  assert.equal(percentile95(vals), 96); // floor(100*0.95)=95 → 第96个
});

test("aggregateDaily：统计口径与 upsert 正确", async () => {
  const mk = (over = {}) => ({
    durationMs: 1000,
    toolErrors: 0,
    degraded: false,
    promptTokens: 10,
    completionTokens: 20,
    costYuan: 0,
    ...over,
  });
  const docs = [
    mk(),
    mk({ toolErrors: 1, degraded: true }),
    mk({ durationMs: 50000 }),
  ];
  const db = mockDb({ docs });
  const { summary, alerts } = await aggregateDaily(db, "2026-10-09");
  assert.equal(summary.total, 3);
  assert.equal(summary.errorRate, 0.333);
  assert.equal(summary.degradedRate, 0.333);
  assert.equal(summary.promptTokens, 30);
  assert.equal(summary.completionTokens, 60);
  assert.ok(db.setDocs["daily_2026-10-09"]);
  // 3 条样本 < 10，不告警（防抖）
  assert.equal(alerts.length, 0);
});

test("aggregateDaily：超阈值触发告警落库", async () => {
  const docs = Array.from({ length: 12 }, () => ({
    durationMs: 1000,
    toolErrors: 1, // 100% 错误率
    degraded: true, // 100% 降级率
    promptTokens: 0,
    completionTokens: 0,
    costYuan: 0,
  }));
  const db = mockDb({ docs });
  const { alerts } = await aggregateDaily(db, "2026-10-09");
  assert.ok(alerts.length >= 2); // 错误率+降级率两条
  assert.ok(db.added.some((a) => a.name === "metrics_alerts"));
});

test("isOverBudget：未超限 false，达预算 true，DB 故障视为未超限", async () => {
  const under = mockDb({ budgetDoc: { completionTokens: DAILY_TOKEN_BUDGET - 1 } });
  assert.equal(await isOverBudget(under, "u1"), false);
  const over = mockDb({ budgetDoc: { completionTokens: DAILY_TOKEN_BUDGET } });
  assert.equal(await isOverBudget(over, "u1"), true);
  const broken = mockDb({ failGet: true });
  assert.equal(await isOverBudget(broken, "u1"), false);
});

test("recordRequest：落库失败静默不抛错", async () => {
  const db = mockDb({ failAdd: true });
  await assert.doesNotReject(() => recordRequest(db, { openid: "u1" }));
});

console.log("metrics 单测加载完成");
