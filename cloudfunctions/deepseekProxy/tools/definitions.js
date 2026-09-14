/**
 * Agent 工具 JSON Schema 定义（随请求发给模型）
 * 与 executors/ 目录的执行器按 name 对应
 */
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description:
        "检索知识库（含思维训练题库、学科常见问题、AI 与科学知识、生图灵感模板）。当用户提问学科知识、数学/科学问题、要谜题或脑筋急转弯、要生图灵感、问'为什么'时，必须先调用本工具检索参考内容，再基于结果回答。回答学科作业类问题时遵循红黄绿原则：给思路引导，不直接给完整答案。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "检索关键词（从用户问题中提炼的核心词，如'分数加法''彩虹原理''脑筋急转弯'）",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_challenge",
      description:
        "为用户推荐一个思维训练挑战或成长任务（谜题/脑筋急转弯/动手实验/周末挑战）。当用户说'无聊''不知道做什么''推荐个挑战''给我出个题'或对话收尾时适合调用。会结合用户的历史话题和培养方向做个性化推荐。",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "可选的兴趣方向关键词（如'数学''科学实验'），不传则根据用户画像推荐",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_session",
      description:
        "当一轮学习结束时（用户表示理解了/道谢/结束话题），且本轮对话有实质学习内容时调用，生成 40 字以内的学习小结并归档。小结要突出：今天探索了什么、有什么收获。",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "学习小结（40 字以内，面向孩子的鼓励语气）",
          },
          topics: {
            type: "array",
            items: { type: "string" },
            description: "本轮涉及的话题标签（2-4 个，如['分数','推理']）",
          },
        },
        required: ["summary", "topics"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "award_growth_points",
      description:
        "当识别到用户提出了深刻、富有好奇心、批判性思维或逻辑严密的高质量问题/反思时调用，为用户发放探索积分。",
      parameters: {
        type: "object",
        properties: {
          points: {
            type: "number",
            description: "奖励积分数，范围 5~15",
            minimum: 5,
            maximum: 15,
          },
          reason: { type: "string", description: "简短加分原因" },
        },
        required: ["points", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_creative_portfolio",
      description:
        "当识别到用户在对话中完成了一篇完整的故事创作、创意方案、科幻设想或逻辑推理产出时调用，将其归档到云端作品集。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "提炼的作品标题（12字以内）" },
          category: { type: "string", enum: ["story", "idea", "science"] },
          content: { type: "string", description: "作品核心内容全文" },
        },
        required: ["title", "category", "content"],
      },
    },
  },
];

module.exports = { TOOL_DEFINITIONS };
