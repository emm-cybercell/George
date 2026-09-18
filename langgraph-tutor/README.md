# LangGraph 对照轨（langgraph-tutor）

用 **LangGraph.js StateGraph** 把「桥智同学」的核心任务重新实现一遍，与自研 agent-core（`cloudfunctions/deepseekProxy/core/framework/`）跑**同一评测集**，做框架选型对比——这是本项目的 Phase 4（双轨实验）。

## 图结构

```
START → classify ── casual ──→ respond ──→ END
           │
       knowledge/challenge
           ↓
        rewrite → retrieve → grade → respond → END
```

- **classify**：意图分类（knowledge / casual / challenge），闲聊直接应答不检索（省成本）
- **rewrite**：查询改写 + 同义扩展（与自研轨同一提示词，保证对照公平）
- **retrieve**：双路稀疏召回 + RRF 融合（复用自研轨 `retrievalCore.js` 纯函数）
- **grade**：Self-RAG 式文档相关性过滤（LLM 批量打分，全滤掉时保留原样兜底）
- **respond**：注入知识库参考的红黄绿原则应答
- **MemorySaver checkpointer**：同 `thread_id` 多轮自动携带历史

## 双轨公平性设计

| 维度 | 自研 agent-core | LangGraph 轨 |
|---|---|---|
| 模型调用 | `framework/llm.js`（axios + 429 退避） | **同一个客户端实例注入** |
| 检索核心 | `retrievalCore.js` | **同一份纯函数** |
| 提示词 | 改写/评分 prompt | 同一 prompt 文案 |
| 差异变量 | —— | **只有编排方式**（手写循环 vs StateGraph） |

## 选型对比结论（面试答法）

| 维度 | 自研循环 | LangGraph |
|---|---|---|
| 灵活性 | 循环控制/终止判定/trace 全在手里，业务可深度定制（如步数耗尽强制总结） | 分支固定在图结构上，动态循环（如 ReAct 步数自适应）需绕行实现 |
| 可观测 | trace 天然逐轮产出 | 需要额外订阅流式事件重组 |
| 依赖成本 | 0 依赖，云函数包体小 | 引入 langgraph + langchain-core（小程序云函数体积敏感） |
| 多轮记忆 | 手工管理会话窗口 | checkpointer 开箱即得，写起来最短 |
| 生态 | 自维护 | 预置节点/checkpoint/中断恢复等生态件 |

**最终选型：小程序主链路用自研**（轻量可控、云函数零依赖、trace 可观测是硬需求）；LangGraph 适合需要复杂分支/人工中断/checkpoint 恢复的场景，本项目的意图路由图就是它的舒适区——**不是谁好谁坏，是场景匹配**。

## 运行

```bash
cd langgraph-tutor && npm install

# 单轮对话
CB_GATEWAY_KEY=xxx CB_GATEWAY_URL=xxx node index.js "乘除哪个先算" --show-docs

# 检索评测（与自研轨同一黄金集）
CB_GATEWAY_KEY=xxx CB_GATEWAY_URL=xxx node eval.js
```

单测：`node --test tests/langgraph.spec.js`（mock llm，不触网）
