import { View, Text } from "@tarojs/components";

/** 历史详情气泡行 */
export interface HistoryRow {
  role: "user" | "assistant";
  content: string;
}

interface HistoryCardProps {
  title: string;
  timeText: string;
  rows: HistoryRow[];
  showContinue: boolean;
  expanded: boolean;
  /** 整卡点击：打开/恢复该对话 */
  onOpen: () => void;
  /** 展开/收起详情 */
  onToggle: () => void;
  /** 本地会话"继续"按钮 */
  onContinue?: () => void;
  onDelete: () => void;
}

/** 时间戳转 "M-D HH:mm" */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 标题截断 12 字 */
export function titleOf(text: string): string {
  return text.length > 12 ? `${text.slice(0, 12)}…` : text;
}

const HistoryCard = ({
  title,
  timeText,
  rows,
  showContinue,
  expanded,
  onOpen,
  onToggle,
  onContinue,
  onDelete,
}: HistoryCardProps) => (
  <View className="history__session">
    <View className="history__row" onClick={onOpen}>
      <View className="history__info">
        <Text className="history__label">{title}</Text>
        <Text className="history__time">{timeText}</Text>
      </View>
      {showContinue && (
        <View
          className="history__continue-btn"
          onClick={(e) => {
            e.stopPropagation();
            onContinue?.();
          }}
        >
          💬 继续
        </View>
      )}
      <Text
        className="history__arrow"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {expanded ? "▾" : "›"}
      </Text>
    </View>

    {expanded && (
      <View className="history-detail">
        {rows.map((m, i) => (
          <View
            key={`row-${i}`}
            className={`history-detail__row ${
              m.role === "user"
                ? "history-detail__row--user"
                : "history-detail__row--ai"
            }`}
          >
            <View
              className={`history-detail__bubble ${
                m.role === "user"
                  ? "history-detail__bubble--user"
                  : "history-detail__bubble--ai"
              }`}
            >
              <Text>{m.content}</Text>
            </View>
          </View>
        ))}
        <View className="history-detail__actions">
          <View className="history-detail__open" onClick={onOpen}>
            💬 继续对话
          </View>
          <View className="history-detail__delete" onClick={onDelete}>
            🗑 删除该对话
          </View>
        </View>
      </View>
    )}
  </View>
);

export default HistoryCard;
