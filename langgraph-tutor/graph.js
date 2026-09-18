/**
 * LangGraph 对照轨：StateGraph 实现 意图→改写→检索→打分(红黄绿)→应答
 * - 编排用 @langchain/langgraph（节点/条件边/checkpointer），模型 I/O 复用
 *   自研框架同一份 llm.js 客户端（axios + 429 退避）——双轨模型调用完全同源，
 *   评测对比只反映编排差异，这是对照实验的公平性前提
 * - 检索复用 cloudfunctions/deepseekProxy/core/retrievalCore.js 纯函数
 * - MemorySaver checkpointer 支持同 thread_id 多轮记忆
 *
 * 图结构：
 *   START → classify ┬─ casual ──→ respond ─→ END
 *                    └─ knowledge → rewrite → retrieve → grade → respond → END
 *   （grade：Self-RAG 式文档相关性过滤；无相关文档时 respond 直接作答）
 */
const { StateGraph, Annotation, START, END, MemorySaver } = require("@langchain/langgraph");
const { search } = require("../cloudfunctions/deepseekProxy/core/retrievalCore");

/** 与自研轨共享的提示词（改写）——保证双轨可对照 */
const REWRITE_SYSTEM =
  '你是检索查询改写器。把学生的口语化提问改写为适合关键词检索的查询，并给出 1-2 个同义表达。只输出 JSON：{"rewritten":"改写后查询","synonyms":["同义1"]}';

const CLASSIFY_SYSTEM =
  '判断学生输入的意图类别。只输出 JSON：{"intent":"knowledge"或"casual"或"challenge"}\n- knowledge：知识提问（需要查知识库）\n- casual：闲聊/陪伴/情绪表达（无需检索）\n- challenge：想要挑战/题目/任务（需要检索 quiz/mission）';

const GRADE_SYSTEM =
  '你是检索文档相关性评估器。判断给定文档是否有助于回答查询。只输出 JSON：{"relevant":true}或{"relevant":false}';

const RESPOND_SYSTEM =
  '你是 8-14 岁学生的学习搭档"桥智同学"。遵循 AI 作业红黄绿原则：不直接代写作业答案（红），给提示与引导（黄），讲思路方法（绿）。回答口语化、贴合学段。';

/** 状态注解：全部字段 last-value 语义 */
const TutorState = Annotation.Root({
  messages: Annotation({ reducer: (l = [], r) => r ?? l, default: () => [] }),
  query: Annotation({ reducer: (l, r) => r ?? l }),
  intent: Annotation({ reducer: (l, r) => r ?? l }),
  rewritten: Annotation({ reducer: (l, r) => r ?? l }),
  docs: Annotation({ reducer: (l = [], r) => r ?? l, default: () => [] }),
  gradedDocs: Annotation({ reducer: (l = [], r) => r ?? l, default: () => [] }),
  answer: Annotation({ reducer: (l, r) => r ?? l }),
  /** eval 模式：只跑检索前段，跳过 grade/respond 的 LLM 消耗 */
  retrievalOnly: Annotation({ reducer: (l, r) => r ?? l, default: () => false }),
});

/**
 * 构建对照图
 * @param {{chat: Function, chatJSON: Function}} llm 自研框架 LLM 客户端（注入）
 * @param {Array} docs 检索语料（与评测集同源）
 */
function createTutorGraph(llm, docs) {
  async function classify(state) {
    if (state.retrievalOnly) return { intent: "knowledge" }; // 评测模式全走检索前段
    try {
      const r = await llm.chatJSON(
        [
          { role: "system", content: CLASSIFY_SYSTEM },
          { role: "user", content: state.query },
        ],
        { temperature: 0.1 },
      );
      const intent = ["knowledge", "casual", "challenge"].includes(r.intent)
        ? r.intent
        : "casual";
      return { intent };
    } catch {
      return { intent: "casual" }; // 分类失败按闲聊处理（不检索，可用性优先）
    }
  }

  async function rewrite(state) {
    try {
      const r = await llm.chatJSON(
        [
          { role: "system", content: REWRITE_SYSTEM },
          { role: "user", content: state.query },
        ],
        { temperature: 0.2 },
      );
      const synonyms = (r.synonyms || []).slice(0, 2).join(" ");
      return { rewritten: [r.rewritten, synonyms].filter(Boolean).join(" ") || state.query };
    } catch {
      return { rewritten: state.query };
    }
  }

  async function retrieve(state) {
    const preferTypes =
      state.intent === "challenge" ? { preferTypes: ["quiz", "mission"] } : {};
    const legA = search(state.query, docs, { topK: 8, threshold: 0.01 });
    const legB =
      state.rewritten === state.query
        ? []
        : search(state.rewritten, docs, { topK: 8, threshold: 0.01 });
    // RRF 融合（与自研轨同式）
    const K = 60;
    const scores = new Map();
    for (const list of [legA, legB]) {
      list.forEach((h, i) => {
        const key = h.doc.question;
        scores.set(key, (scores.get(key) || 0) + 1 / (K + i + 1));
      });
    }
    const byQuestion = new Map([...legA, ...legB].map((h) => [h.doc.question, h.doc]));
    const fused = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([q]) => byQuestion.get(q));
    return { docs: fused };
  }

  async function grade(state) {
    if (state.retrievalOnly || state.docs.length === 0) return { gradedDocs: state.docs };
    // Self-RAG 式逐文档打分；批量构造一次调用（top8 控制成本）
    try {
      const listing = state.docs
        .map((d, i) => `${i + 1}. ${d.question}：${String(d.answer).slice(0, 60)}`)
        .join("\n");
      const r = await llm.chatJSON(
        [
          {
            role: "system",
            content:
              '你是检索文档相关性评估器。对每个候选判断是否有助于回答查询。只输出 JSON：{"verdicts":[{"id":1,"relevant":true}]}',
          },
          { role: "user", content: `【查询】${state.query}\n【候选】\n${listing}` },
        ],
        { temperature: 0.1 },
      );
      const byId = new Map((r.verdicts || []).map((v) => [Number(v.id), !!v.relevant]));
      const kept = state.docs.filter((_, i) => byId.get(i + 1) !== false);
      return { gradedDocs: kept.length ? kept : state.docs }; // 全被滤掉时保留原样
    } catch {
      return { gradedDocs: state.docs };
    }
  }

  async function respond(state) {
    if (state.retrievalOnly) return {};
    const context = (state.gradedDocs || [])
      .slice(0, 3)
      .map((d) => `- ${d.question}：${String(d.answer).slice(0, 150)}`)
      .join("\n");
    const history = state.messages
      .slice(-8)
      .map((m) => `${m.role === "user" ? "学生" : "桥智"}：${m.content}`)
      .join("\n");
    const msg = await llm.chat(
      [
        { role: "system", content: RESPOND_SYSTEM },
        ...(context
          ? [{ role: "system", content: `【知识库参考】\n${context}` }]
          : []),
        ...(history ? [{ role: "user", content: history }] : []),
        { role: "user", content: state.query },
      ],
      { temperature: 0.7 },
    );
    return { answer: msg.content || "" };
  }

  const compiled = new StateGraph(TutorState)
    .addNode("classify", classify)
    .addNode("rewrite", rewrite)
    .addNode("retrieve", retrieve)
    .addNode("grade", grade)
    .addNode("respond", respond)
    .addEdge(START, "classify")
    .addConditionalEdges("classify", (s) =>
      s.intent === "casual" ? "respond" : "rewrite",
    )
    .addEdge("rewrite", "retrieve")
    .addEdge("retrieve", "grade")
    .addEdge("grade", "respond")
    .addEdge("respond", END)
    .compile({ checkpointer: new MemorySaver() });

  return { graph: compiled, checkpointer: null };
}

/** 便捷调用：跑一次完整图（threadId 复用即多轮） */
async function runTutor(llm, docs, { query, messages = [], threadId = "default", retrievalOnly = false }) {
  const { graph } = createTutorGraph(llm, docs);
  const final = await graph.invoke(
    { query, messages, retrievalOnly },
    { configurable: { thread_id: threadId } },
  );
  return final;
}

module.exports = { createTutorGraph, runTutor, TutorState };
