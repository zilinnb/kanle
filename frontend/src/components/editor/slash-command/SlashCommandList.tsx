"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ComponentType,
} from "react";

export interface SlashCommandItem {
  title: string;
  icon: ComponentType<{ className?: string }>;
  description?: string;
  keywords?: string;
}

export interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export interface SlashCommandListRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) command(item);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) =>
            prev === 0 ? items.length - 1 : prev - 1
          );
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) =>
            prev === items.length - 1 ? 0 : prev + 1
          );
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="slash-command-list">
          <div className="slash-command-empty">无匹配命令</div>
        </div>
      );
    }

    return (
      <div className="slash-command-list">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              className={`slash-command-item ${
                index === selectedIndex ? "is-selected" : ""
              }`}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="slash-command-icon">
                <Icon className="h-4 w-4" />
              </span>
              <span className="slash-command-text">
                <span className="slash-command-title">{item.title}</span>
                {item.description && (
                  <span className="slash-command-desc">{item.description}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    );
  }
);

SlashCommandList.displayName = "SlashCommandList";

export default SlashCommandList;
