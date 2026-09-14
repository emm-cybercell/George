/**
 * 作品归档工具执行器：写入 creative_works 集合（与作品集页同源）
 */

/** 标题截断 12 字 */
function titleOf(t) {
  const s = String(t || "未命名作品").trim();
  return s.length > 12 ? s.slice(0, 12) : s;
}

/** 作品自主归档 */
const save_creative_portfolio = async ({ db, openid, args }) => {
  const title = titleOf(args.title);
  const category = ["story", "idea", "science"].includes(args.category)
    ? args.category
    : "idea";
  const content = String(args.content || "").slice(0, 2000);
  try {
    await db.collection("creative_works").add({
      data: {
        _openid: openid,
        title,
        category,
        mediaType: "text",
        content,
        abilityMode: "",
        createTime: Date.now(),
      },
    });
    return { success: true, title, category };
  } catch (err) {
    console.error("save_creative_portfolio error:", err);
    return { success: false, error: String(err.message || err) };
  }
};

module.exports = { PORTFOLIO_EXECUTORS: { save_creative_portfolio } };
