export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 图片消息的云存储文件路径（cloud://...） */
  mediaUrl?: string;
  /** 云端 chat_history 文档 _id（反馈回写定位） */
  cloudRecordId?: string;
  /** 用户反馈：null 未评价 / true 点赞 / false 点踩 */
  liked?: boolean | null;
  /** 该轮 AI 是否参考了知识库（检索工具命中） */
  usedKnowledge?: boolean;
  /** 话题标签（知识库检索命中） */
  topics?: string[];
  /** AI 响应耗时 ms */
  responseTime?: number;
  /** 本轮 Agent 实际执行的工具标签（如 📚 知识检索） */
  toolLabels?: string[];
  /** 知识检索命中的条数（展示"参考了 N 条知识"） */
  knowledgeHits?: number;
  /** AI 生图时的原始 prompt（一键收藏作品集用） */
  prompt?: string;
}
