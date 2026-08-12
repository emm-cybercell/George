/** 底部 Tab 键 */
export type TabKey = "learn" | "home" | "profile";

/** 学习页 AI 对话状态 */
export type ChatState = "idle" | "thinking" | "chatting";

/** 学习页快捷 Prompt 胶囊 */
export interface PromptItem {
  id: string;
  text: string;
}

/** 我的页荣誉勋章 */
export interface BadgeItem {
  id: string;
  title: string;
  icon: string;
  unlocked: boolean;
}

/** 我的页用户信息 */
export interface UserInfo {
  nickname: string;
  grade: string;
  birthday: string;
  score: number;
}
