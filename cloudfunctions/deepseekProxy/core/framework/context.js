/**
 * Context Builder：上下文工程
 * - 分层组装：人设 → 用户画像(年级/培养方向) → 长期记忆 → 运行时模式 → 历史
 * - token 预算：中文按 ~1.6 字/token 估算，超预算的历史消息做压缩摘要
 */

/** 粗略 token 估算：CJK 字符 1 字 ≈ 0.6 token，ASCII 4 字符 ≈ 1 token */
function estimateTokens(text) {
  const cjk = (String(text).match(/[\u4e00-\u9fff]/g) || []).length;
  const rest = String(text).length - cjk;
  return Math.ceil(cjk * 0.6 + rest / 4);
}

/** 单条消息压缩：保留首尾，中间省略 */
function compressMessage(content, maxChars = 200) {
  const s = String(content || "");
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars - 40)}…（中略）…${s.slice(-20)}`;
}

/**
 * 构建系统提示词（分层）
 * @param {{persona: string, grade?: string, abilityName?: string, abilityGuidance?: string,
 *          memories?: string[], webSearch?: boolean}} layers
 */
function buildSystemPrompt(layers) {
  const parts = [layers.persona];
  if (layers.grade) {
    parts.push(
      `【用户画像】：${layers.grade}的学生，请用匹配该学段的词汇、例子和知识深度回答。`,
    );
  }
  if (layers.abilityName && layers.abilityGuidance) {
    parts.push(
      `【当前重点培养侧重】：请在对话中特别贯彻"${layers.abilityName}"原则：${layers.abilityGuidance}`,
    );
  }
  if (layers.memories && layers.memories.length > 0) {
    parts.push(
      `【长期记忆·往期学习小结】：\n${layers.memories.map((m) => `- ${m}`).join("\n")}`,
    );
  }
  if (layers.webSearch) {
    parts.push(
      "【联网模式】：用户开启了联网搜索，请结合时效性信息回答，并注明信息可能随时间变化。",
    );
  }
  return parts.join("\n\n");
}

/**
 * 构建最终消息数组：系统层 + 预算内历史
 * @param {string} systemPrompt
 * @param {Array<{role, content}>} history 全部历史
 * @param {{maxHistoryTokens?: number, maxMessageTokens?: number}} budget
 */
function buildMessages(systemPrompt, history, budget = {}) {
  const maxHistoryTokens = budget.maxHistoryTokens ?? 6000;
  const maxMessageTokens = budget.maxMessageTokens ?? 900;

  // 从最新往回收集，直到预算耗尽；更早的消息压缩为一条摘要
  const kept = [];
  let used = estimateTokens(systemPrompt);
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const t = estimateTokens(m.content);
    if (used + t > maxHistoryTokens) break;
    kept.unshift(m);
    used += t;
  }
  const overflow = history.length - kept.length;

  const messages = [{ role: "system", content: systemPrompt }];
  if (overflow > 0) {
    const digest = history
      .slice(0, overflow)
      .map((m) => `${m.role}: ${compressMessage(m.content, 60)}`)
      .join("\n");
    messages.push({
      role: "system",
      content: `【早期对话摘要】（已压缩 ${overflow} 条）：\n${compressMessage(digest, 500)}`,
    });
  }
  for (const m of kept) {
    messages.push({
      role: m.role,
      content:
        m.role === "user" || m.role === "assistant"
          ? compressMessage(m.content, maxMessageTokens * 2.5)
          : m.content,
    });
  }
  return messages;
}

module.exports = { estimateTokens, compressMessage, buildSystemPrompt, buildMessages };
