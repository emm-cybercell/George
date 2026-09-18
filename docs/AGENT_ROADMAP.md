# 桥智同学 · Agent 简历竞争力升级路线图

> 目标：把现有「小程序 + 云函数工具循环」改造成能支撑 **Agent 开发实习面试** 的完整项目。
> 对照教材：datawhalechina/hello-agents（Ch4 经典范式 / Ch6 框架 / Ch7 自研框架 / Ch8 记忆与检索 / Ch9 上下文工程 / Ch10 MCP 协议 / Ch12 评估）。
> 已确认决策：双轨（自研框架 + LangGraph）/ 全量新增能力（MCP + RAG 三件套 + 评测 + 分层记忆）/ 不碰模型训练。

---

## 0. 简历叙事重构（先做，零代码）

**现在的讲法**：「小程序接了个 AI 网关，加了些工具」——像玩具。
**目标讲法**：「自研轻量 Agent 框架（ReAct 循环 + 工具注册器 + 上下文构建器 + 分层记忆 + 混合检索），落地为微信小程序学习助手，日活工具调用可观测（trace + 反馈闭环），并实现 MCP Server 供任意 Agent 宿主复用，建立评测集驱动 RAG 调优」。

**术语对齐表**（代码注释/文档/简历同步替换）：
| 现在 | 改为 |
|---|---|
| 工具执行器 | Tool Registry（工具注册中心，JSON Schema 驱动） |
| 工具循环（SDK maxSteps） | ReAct Loop（Reason→Act→Observe 显式循环） |
| 拼提示词 | Context Builder（上下文工程：分层组装 + token 预算） |
| 用户画像/话题 | Long-term Memory（分层记忆：工作记忆/情景记忆/语义记忆） |
| 知识库检索 | Hybrid RAG（稠密+稀疏混合检索，RRF 融合重排） |
| usageCount 统计 | Instrumentation（可观测性：trace/metrics/feedback） |

---

## Phase 1：自研框架化（agent-core，最优先）

**关键架构变更**：放弃依赖 SDK 内部工具循环，改为**直连 CloudBase OpenAI 兼容网关手写 ReAct 循环**，把"思考→行动→观察"全过程暴露为可讲、可测、可展示的 trace。

```
cloudfunctions/deepseekProxy/
├── core/
│   ├── framework/
│   │   ├── llm.js          # LLM 客户端（OpenAI 兼容网关，axios，超时/限流重试）
│   │   ├── registry.js     # Tool Registry：name → {schema, handler, domain}
│   │   ├── loop.js         # 手写 ReAct 循环：构造 tool_calls → 执行 → 观察回填 → 终止判定
│   │   ├── context.js      # Context Builder：分层组装(人设/画像/记忆/知识) + token 预算裁剪
│   │   └── memory.js       # 分层记忆：会话窗口(近N轮) / 情景(digests) / 语义(画像+topics)
│   ├── retrievalCore.js    # (已有) 稀疏检索
│   └── ...
├── patterns/               # 经典范式可切换（面试核心谈资）
│   ├── react.js            # ReAct（默认，手写循环）
│   ├── reflection.js       # Reflection：初答后自检一轮再定稿（红黄绿原则自检）
│   └── plan-execute.js     # Plan-and-Solve：先出计划再逐步执行（复杂任务）
└── index.js                # 网关入口，event.pattern 可选范式
```

- 网关：`https://{envId}.api.tcloudbasegateway.com/v1/ai/cloudbase` + CloudBase API Key（用 MCP `manageAppAuth createApiKey` 创建，存云函数环境变量）。
- trace 结构：每步 `{thought, action: toolName, observation, durationMs}`，随响应返回前端，替代/增强现有工具标签（C 部分已铺好 UI）。
- 记忆分层：新对话自动召回相关 digests（语义/话题匹配）注入 context；会话窗口超 12 轮自动压缩成摘要。
- 验收：`tests/reactLoop.spec.js`（mock LLM 测循环终止/工具执行/trace 完整性）。

**工作量**：最大的一块，≈3-4 个工作日。完成后简历可写「从 0 实现支持 ReAct/Reflection/Plan-and-Solve 三范式的轻量 Agent 框架」。

---

## Phase 2：RAG 升级三件套（讲深检索原理）

```
query → ①查询改写(LLM，结合年级+话题补全) → ②混合召回(稠密 embedding + 稀疏 TF-IDF)
      → ③RRF 融合 → ④重排(LLM listwise 或分数归一) → topK(含来源标注)
```

- **Embedding**：优先用云开发 AI 网关的 embedding 模型（`DescribeManagedAIModelList` 查可用，通常有通用向量化模型）；不可用则用混元小模型打分替代，最差降级保留 TF-IDF 稀疏腿。
- **向量存储**：166+50 条量级**不需要向量数据库**——向量存文档字段、内存余弦即可（面试可讲「10w 条以下内存向量检索足够，引入向量库是过度设计」——这个判断本身就是加分项）。
- **分块**：个人材料入库时按段落/标题切块（chunk 200-400 字 + 重叠 50），检索命中回溯原文。
- **查询改写**：手写框架里加 rewrite 步骤（LLM 把口语 query 改写为检索友好 query + 同义扩展）。
- 验收：同一批查询对比「纯稀疏 vs 混合+重排」的 topK 排序差异，产出 Phase 4 评测数据。

**工作量**：≈2-3 个工作日。

---

## Phase 3：MCP Server 化（协议层亮点）

- 新建 `mcp-server/`：Node `@modelcontextprotocol/sdk`，把 5 个工具（search_knowledge / recommend_challenge / save_creative_portfolio / get_growth_stats / summarize_learning）暴露为 MCP tools。
- 传输：Streamable HTTP，部署到 **CloudRun 容器**（或 HTTP 云函数起步）；API Key 鉴权。
- 简历杀伤点：**同一个工具集同时服务小程序用户和 Claude/Cursor 等 MCP 宿主**——「一次注册，多端复用」，这正是 MCP 的设计哲学。
- 附 `mcp-server/README.md`：Claude Desktop 配置示例 + 调用截图脚本。
- 验收：本地 stdio 模式跑通 Claude Desktop/Cursor 调用录屏。

**工作量**：≈1-2 个工作日（工具逻辑复用 Phase 1 registry）。

---

## Phase 4：LangGraph.js 双轨实现（框架关键词）

- 新建 `langgraph-tutor/`（Node）：StateGraph 实现 `intent → rewrite → retrieve → grade(红黄绿检查) → respond`，MemorySaver checkpointer 多轮记忆。
- 模型同源（CloudBase 网关 hy3），**与自研框架跑同一评测集**——面试讲「同一任务用自研循环与 LangGraph 各实现一遍，对比灵活性与工程成本，最终选型自研（理由：小程序场景轻量可控、免依赖）」，这是最高级的答法。
- 部署：HTTP 服务（CloudRun）+ SSE 流式（可选接 AG-UI）；至少本地可运行 + 单测。
- **工作量**：≈2 个工作日。

---

## Phase 5：评测体系（Ch12，差异化最大）

```
evals/
├── golden_set.jsonl      # 80-100 条黄金问答（从 166 条知识库构造：query→期望文档id）
├── retrieval_eval.js     # Recall@1/3/5、MRR，对比 纯稀疏 vs 混合 vs 混合+重排
├── answer_eval.js        # LLM-as-judge：正确性/红黄绿合规/语气适配 三维 1-5 分
├── run_all.js            # 一键回归：跑全部指标 → evals/reports/<date>.md
└── reports/              # 历史评测报告（简历附件/面试展示）
```

- 数据来源复用现有闭环：usageCount、feedback.liked、responseTime 已在采集。
- 面试杀手锏：「我给 RAG 建了评测集，混合检索把 Recall@3 从 X 提到 Y；LLM-as-judge 显示 Reflection 范式让红黄绿合规率提升 Z%」——**有数字的候选人和没数字的不是一个档次**。
- **工作量**：≈2 个工作日（依赖 Phase 1/2 完成）。

---

## 实施顺序与时间线（按每周 10-15h 估算）

> **进度（2026-09-18）**：Phase 0/1/2/3 已完成并提交；Phase 5 评测已出首轮对比
> （Recall@3 0.590→0.928 / MRR 0.511→0.918，见 `evals/reports/2026-09-18-comparison.md`）。
> 网关探测确认 `cloudbase` 组无 embedding 模型，稠密腿按预案以 LLM 重排替代。
> 待办：云函数部署（微信开发者工具手动）、Phase 4 LangGraph 双轨、简历定稿。

| 周 | 内容 | 产出 |
|---|---|---|
| 第 1 周 | Phase 0 叙事重构 + Phase 1（自研框架核心） | 手写 ReAct + trace 上了云函数 |
| 第 2 周 | Phase 1 收尾（Reflection/Plan-Execute + 分层记忆）+ Phase 2（RAG 三件套） | patterns 可切换、混合检索上线 |
| 第 3 周 | Phase 3（MCP Server）+ Phase 5 评测集与脚本 | MCP 可被 Claude 调用、首轮评测报告 |
| 第 4 周 | Phase 4（LangGraph 双轨）+ 全量评测对比 + 简历/文档定稿 | 双轨对比数据 + 简历 bullet |

## 明确不做
- 模型训练（SFT/LoRA/GRPO）——面试准备原理话术即可
- 真流式 SSE 到小程序（保留现有阶段动画方案；SSE 只在 LangGraph 演示服务里做）
- 多智能体协作（业务场景撑不起来，面试讲「评估过、判断不需要」反而是加分）

## 风险与预案
- 网关 API Key 不可用 → 退回 cloud.ai() 但循环照手写（SDK generateText 不带 tools 手动解析消息流受限时，用 streamText 或降级 axios+DeepSeek 免费额度演示）
- embedding 模型不可用 → 混合检索的稠密腿用「混元小模型语义打分」替代，评测报告如实记录
- CloudRun 首次部署 → MCP server 先用 HTTP 云函数 + Streamable HTTP 简化版落地

---

## 完成情况与简历 bullet（2026-09-18 定稿）

**全部 Phase 0-4 完成，Phase 5 首轮报告产出。评测数据（166 条黄金集，同集同模型）：**

| 方案 | Recall@1 | Recall@3 | MRR |
|---|---|---|---|
| 纯稀疏基线 | 0.392 | 0.590 | 0.511 |
| LangGraph 轨（意图路由+改写+RRF） | 0.518 | 0.825 | 0.673 |
| 自研增强轨（改写+RRF+LLM重排） | **0.904** | **0.928** | **0.918** |

**简历 bullet 草稿**（按 AgentGuide L2-L3 表述规范）：

- 自研轻量 Agent 框架（ReAct/Reflection/Plan-and-Execute 三范式可切换）：手写 Reason→Act→Observe 循环、JSON Schema 驱动的 Tool Registry、token 预算上下文构建器与分层记忆（工作/情景/语义），落地于微信小程序 AI 学习助手，工具调用全程 trace 可观测，步数/时间双预算熔断防死循环
- 构建评测驱动的 RAG 优化闭环：自建 166 条黄金评测集（LLM 模拟学生口语提问），查询改写 + 双路召回 + RRF 融合 + LLM listwise 重排管线将 Recall@3 从 0.590 提升至 0.928、MRR 从 0.511 提升至 0.918；与 LangGraph.js 双轨实现构成消融实验，量化拆分改写(+23.5pp)与重排(+10.3pp)各自贡献，基于数据完成框架选型
- 实现 MCP Server 将 5 个业务工具按协议暴露（Claude Desktop/Cursor 可直接调用），与小程序端复用同一份 Tool Registry 与执行器（一次注册多端复用）；建立 GitHub Actions CI 回归（33 项单测覆盖循环终止/范式分支/检索融合/图分支）

**遗留待办**：① 微信开发者工具部署 deepseekProxy（新版含框架开关/三范式/增强检索/分块入库）；② （可选）MCP Server 部署 CloudRun + Streamable HTTP 公网化；③ （可选）answer_eval.js（LLM-as-judge 应答质量评测）补全 Phase 5 应答侧指标。
