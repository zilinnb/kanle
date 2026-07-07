export interface TimeLabel {
  key: string;
  label: string;
  /** 渲染类型：今天/昨天用文字，其他用大号日期+小号月份 */
  type: "today" | "yesterday" | "date";
  day: number;
  month: number;
  year: number;
  /** 小号月份文本，如 "6月" / "06月" */
  monthLabel: string;
  /** 大号日期文本，如 "26" */
  dayLabel: string;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function getTimeLabel(iso: string): TimeLabel {
  const date = new Date(iso);
  const now = new Date();
  const today = stripTime(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const d = stripTime(date);

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayLabel = String(day);
  const monthLabel = `${month}月`;

  if (d.getTime() === today.getTime()) {
    return { key: "today", label: "今天", type: "today", day, month, year, monthLabel, dayLabel };
  }
  if (d.getTime() === yesterday.getTime()) {
    return { key: "yesterday", label: "昨天", type: "yesterday", day, month, year, monthLabel, dayLabel };
  }

  const sameYear = year === now.getFullYear();
  return {
    key: sameYear ? `${year}-${month}` : `${year}-${month}`,
    label: sameYear ? `${month}月` : `${year}年${month}月`,
    type: "date",
    day,
    month,
    year,
    monthLabel,
    dayLabel,
  };
}

export interface TimeGroup<T> {
  key: string;
  label: string;
  type: "today" | "yesterday" | "date";
  monthLabel: string;
  dayLabel: string;
  items: T[];
}

export function groupByTime<T extends { createdAt: string }>(items: T[]): TimeGroup<T>[] {
  const groups: TimeGroup<T>[] = [];
  let current: TimeGroup<T> | null = null;

  for (const item of items) {
    const info = getTimeLabel(item.createdAt);
    if (!current || current.key !== info.key) {
      current = {
        key: info.key,
        label: info.label,
        type: info.type,
        monthLabel: info.monthLabel,
        dayLabel: info.dayLabel,
        items: [],
      };
      groups.push(current);
    }
    current.items.push(item);
  }

  return groups;
}
