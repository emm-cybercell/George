/**
 * 个人材料分块（RAG ingestion 侧）
 * 长文本按滑窗切块（约 200-400 字，重叠 ~50 字），切块时优先回退到
 * 段落/句号边界，避免切断语义；检索命中即可直接引用局部内容。
 */

/**
 * @param {string} text 原始文本
 * @param {number} maxLen 单块目标上限
 * @param {number} overlap 相邻块重叠字符数
 * @returns {string[]} 块数组（至少 1 块）
 */
function chunkMaterial(text, maxLen = 350, overlap = 50) {
  const clean = String(text || "").trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxLen, clean.length);
    if (end < clean.length) {
      // 在窗口后半段找最近的语义边界（换行/句号），避免拦腰切断
      const window = clean.slice(start, end);
      const brk = Math.max(
        window.lastIndexOf("\n"),
        window.lastIndexOf("。"),
      );
      if (brk > maxLen * 0.5) end = start + brk + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}

module.exports = { chunkMaterial };
