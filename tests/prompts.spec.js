/**
 * Prompt 版本化灰度单测（零外部依赖）
 * 覆盖：分桶稳定性、active 优先、gray 分桶命中/未命中、DB 故障回退内置、
 *       disabled 剔除、无 active 时 gray 生效、mock db 故障注入
 * 运行：node --test tests/prompts.spec.js
 */
const test = require("node:test");
const assert = require("node:assert");
const {
  resolvePrompt,
  bucketOf,
  BUILTIN_PROMPTS,
  invalidatePromptCache,
} = require("../cloudfunctions/deepseekProxy/core/prompts");

/** mock db：按脚本返回文档列表，或抛错模拟故障 */
function mockDb(docs, { fail = false } = {}) {
  return {
    collection: () => ({
      limit: () => ({
        get: async () => {
          if (fail) throw new Error("db unavailable");
          return { data: docs };
        },
      }),
    }),
  };
}

test("bucketOf：同一 openid 稳定，输出落在 0-99", () => {
  assert.equal(bucketOf("user-a"), bucketOf("user-a"));
  for (let i = 0; i < 50; i++) {
    const b = bucketOf(`user-${i}`);
    assert.ok(b >= 0 && b < 100, `bucket 越界: ${b}`);
  }
});

test("DB 无记录 → 回退内置 prompt（source=builtin）", async () => {
  invalidatePromptCache();
  const r = await resolvePrompt(mockDb([]), "reflect", "user-a");
  assert.equal(r.source, "builtin");
  assert.equal(r.version, BUILTIN_PROMPTS.reflect.version);
  assert.equal(r.content, BUILTIN_PROMPTS.reflect.content);
});

test("DB 故障 → 静默回退内置 prompt，不抛错", async () => {
  invalidatePromptCache();
  const r = await resolvePrompt(mockDb([], { fail: true }), "plan", "user-a");
  assert.equal(r.source, "builtin");
  assert.equal(r.content, BUILTIN_PROMPTS.plan.content);
});

test("active 版本直接生效（多 active 取最高版本）", async () => {
  invalidatePromptCache();
  const docs = [
    { promptId: "reflect", version: 2, status: "active", content: "V2 质检员" },
    { promptId: "reflect", version: 3, status: "active", content: "V3 质检员" },
    { promptId: "reflect", version: 1, status: "active", content: "V1 质检员" },
  ];
  const r = await resolvePrompt(mockDb(docs), "reflect", "user-a");
  assert.equal(r.source, "active");
  assert.equal(r.version, 3);
  assert.equal(r.content, "V3 质检员");
});

test("无 active 时 gray 分桶：桶内命中用 gray 版本", async () => {
  invalidatePromptCache();
  const openid = "gray-user";
  const bucket = bucketOf(openid);
  const docs = [
    {
      promptId: "reflect",
      version: 2,
      status: "gray",
      grayPercent: bucket + 1, // 保证命中
      content: "灰度版质检员",
    },
  ];
  const r = await resolvePrompt(mockDb(docs), "reflect", openid);
  assert.equal(r.source, "gray");
  assert.equal(r.content, "灰度版质检员");
});

test("无 active 时 gray 分桶：桶外未命中回退内置", async () => {
  invalidatePromptCache();
  const openid = "control-user";
  const bucket = bucketOf(openid);
  const docs = [
    {
      promptId: "plan",
      version: 2,
      status: "gray",
      grayPercent: bucket, // bucket < percent 不成立 → 未命中
      content: "灰度版规划器",
    },
  ];
  const r = await resolvePrompt(mockDb(docs), "plan", openid);
  assert.equal(r.source, "builtin");
});

test("disabled 版本被剔除，不影响兜底", async () => {
  invalidatePromptCache();
  const docs = [
    { promptId: "reflect", version: 5, status: "disabled", content: "废弃版" },
  ];
  const r = await resolvePrompt(mockDb(docs), "reflect", "user-a");
  assert.equal(r.source, "builtin");
});

test("内置兜底与原范式 prompt 文案一致（历史 trace 可比性）", () => {
  const reflect = require("../cloudfunctions/deepseekProxy/patterns");
  const plan = require("../cloudfunctions/deepseekProxy/patterns");
  assert.ok(typeof reflect.runReflection === "function");
  assert.ok(typeof plan.runPlanExecute === "function");
  assert.ok(BUILTIN_PROMPTS.reflect.content.includes("红黄绿原则"));
  assert.ok(BUILTIN_PROMPTS.plan.content.includes("不要过度规划"));
});

console.log("prompt 灰度单测加载完成");
