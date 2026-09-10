export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 图片消息的云存储文件路径（cloud://...） */
  mediaUrl?: string;
}
