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

/** 勋章图鉴定义（云端 unlockedBadges 存 id，渲染时对照解锁状态） */
export interface BadgeDefinition {
  id: string;
  title: string;
  icon: string;
  description: string; // 解锁条件提示
  styleType: "purple" | "green" | "gold";
}

/** 全量勋章图鉴：基础徽章 + 动态解锁徽章 */
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "1",
    title: "未来创造者",
    icon: "🚀",
    description: "加入桥智同学的大家庭",
    styleType: "purple",
  },
  {
    id: "2",
    title: "AI 小法官",
    icon: "⚖️",
    description: "开始练习判断 AI 的回答",
    styleType: "purple",
  },
  {
    id: "3",
    title: "提问大师",
    icon: "🙋",
    description: "完成第一次提问",
    styleType: "green",
  },
  {
    id: "first_chat",
    title: "初次对话",
    icon: "💬",
    description: "与桥智完成首次对话",
    styleType: "green",
  },
  {
    id: "dialogue_5",
    title: "对话达人",
    icon: "🗣️",
    description: "累计完成 5 次对话",
    styleType: "purple",
  },
  {
    id: "streak_3",
    title: "三日坚持",
    icon: "🔥",
    description: "连续打卡 3 天",
    styleType: "gold",
  },
  {
    id: "multi_talent",
    title: "多才多艺",
    icon: "🎨",
    description: "体验 2 种以上培养方向",
    styleType: "gold",
  },
];

/** 学龄年级选项（低段 / 中段 / 高段 / 初高中） */
export const GRADE_OPTIONS = [
  "1-2年级 (低段启蒙)",
  "3-4年级 (中段探索)",
  "5-6年级 (高段进阶)",
  "初中以上",
] as const;

export type UserGrade = (typeof GRADE_OPTIONS)[number];

/** 默认学龄：中段探索 */
export const DEFAULT_GRADE: UserGrade = "3-4年级 (中段探索)";

/** 用户基础档案 */
export interface UserProfile {
  nickName: string;
  avatarUrl: string;
  grade: UserGrade;
  school?: string;
}

/** 用户成长数据 */
export interface UserGrowth {
  points: number; // 积分
  level: number; // 等级（points / 100 + 1）
  currentAbility: string; // 培养方向 ID
  unlockedBadges: string[];
  /** 最近打卡日期（YYYY-MM-DD，同日重复打卡无效） */
  lastCheckInDate?: string;
  /** 连续打卡天数 */
  streakDays?: number;
  /** 累计对话次数 */
  totalChats?: number;
  /** 已体验的培养方向 ID 列表 */
  triedAbilities?: string[];
}

/** 完整云端用户账号（users 集合文档结构） */
export interface FullUserAccount {
  _id?: string;
  _openid?: string;
  profile: UserProfile;
  growth: UserGrowth;
  updateTime: number;
}

/** 每日签到结果 */
export interface CheckInResult {
  success: boolean;
  alreadyCheckedIn?: boolean;
  pointsGained: number;
  streakDays: number;
  newlyUnlockedBadges: string[];
}

/** 对话激励结果 */
export interface AwardChatResult {
  pointsGained: number;
  isLevelUp: boolean;
  newLevel: number;
  newlyUnlockedBadges: string[];
}

/** 创意作品（作品集集合文档结构） */
export interface CreativeWork {
  _id?: string;
  _openid?: string;
  title: string;
  /** 作品分类：画作 / 实物照片 / 故事 / 灵感 */
  category: "drawing" | "photo" | "story" | "idea";
  /** 媒体类型 */
  mediaType: "image" | "text" | "file";
  /** 云存储文件路径（cloud://...） */
  mediaUrl?: string;
  /** 故事说明或 AI 点评内容 */
  content: string;
  abilityMode: string;
  createTime: number;
}

/** 培养能力选项 */
export interface AbilityItem {
  id: string;
  name: string;
  growthIndex: number;
  description: string;
  systemGuidance: string; // 注入给 DeepSeek 的专属引导提示词
}
