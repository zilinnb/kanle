"use client";

import { useState, useRef, useEffect } from "react";
import { Heart, MessageSquare, Pencil, Trash2, Pin, PinOff } from "lucide-react";

interface ActionMenuProps {
  onLike?: () => void;
  onComment?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  liked?: boolean;
  pinned?: boolean;
}

export default function ActionMenu({
  onLike,
  onComment,
  onEdit,
  onDelete,
  onPin,
  liked = false,
  pinned = false,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  // 退出动画：open=false 后延迟卸载，期间播放 pop-out 动画
  const [closing, setClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    if (!open) return;
    setClosing(true);
    setOpen(false);
    setTimeout(() => setClosing(false), 180);
  };

  // 管理员登录后菜单项多（赞/评论/置顶/编辑/删除），手机端需要紧凑布局
  // 未登录时只有赞/评论，用大尺寸（手机和电脑一样大）
  const isFullMenu = !!(onPin && onEdit);
  const itemCls = isFullMenu
    ? "flex h-full items-center gap-[5px] whitespace-nowrap px-3 md:gap-2 md:px-5 text-[13px] md:text-[15px] font-medium hover:bg-[#5c5c5c] transition-colors"
    : "flex h-full items-center gap-2 whitespace-nowrap px-5 text-[15px] font-medium hover:bg-[#5c5c5c] transition-colors";
  const iconCls = isFullMenu
    ? "h-[15px] w-[15px] md:h-[19px] md:w-[19px]"
    : "h-[19px] w-[19px]";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("touchstart", onPointerDown, { passive: true });
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const Divider = () => <div className="h-[20px] w-px bg-[#5c5c5c]" />;

  // 无任何可用操作时不显示按钮
  if (!onLike && !onComment && !onPin && !onEdit && !onDelete) return null;

  return (
    <div className="relative" ref={containerRef}>
      {/* 两个点按钮 — 微信朋友圈风格 */}
      <button
        type="button"
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            setOpen(true);
          }
        }}
        className="flex h-[20px] w-[28px] items-center justify-center rounded-[4px] bg-wechat-bubble transition-colors hover:bg-wechat-hover active:bg-wechat-border"
        aria-label="操作"
      >
        <span className="flex items-center gap-[3px]">
          <span className="h-[3px] w-[3px] rounded-full bg-wechat-nickname" />
          <span className="h-[3px] w-[3px] rounded-full bg-wechat-nickname" />
        </span>
      </button>

      {/* 弹出菜单：赞 / 评论 / 编辑 / 删除 — 微信朋友圈风格 */}
      {(open || closing) && (
        <div
          className={`absolute right-full top-1/2 z-20 mr-1.5 flex h-[38px] origin-right -translate-y-1/2 items overflow-hidden rounded-[7px] bg-[#4c4c4c] text-white shadow-lg ${closing ? "animate-pop-out" : "animate-pop-in"}`}
        >
          {onLike && (
            <button
              type="button"
              onClick={() => {
                onLike();
                closeMenu();
              }}
              className={itemCls}
            >
              <Heart
                className={`${iconCls} ${liked ? "text-red-500" : ""}`}
                fill={liked ? "currentColor" : "none"}
                strokeWidth={1.8}
              />
              <span>{liked ? "取消" : "赞"}</span>
            </button>
          )}
          {onLike && onComment && <Divider />}
          {onComment && (
            <button
              type="button"
              onClick={() => {
                onComment();
                closeMenu();
              }}
              className={itemCls}
            >
              <MessageSquare className={iconCls} strokeWidth={1.8} />
              <span>评论</span>
            </button>
          )}
          {onPin && (onLike || onComment) && <Divider />}
          {onPin && (
            <button
              type="button"
              onClick={() => {
                onPin();
                closeMenu();
              }}
              className={itemCls}
            >
              {pinned ? (
                <PinOff className={iconCls} strokeWidth={1.8} />
              ) : (
                <Pin className={iconCls} strokeWidth={1.8} />
              )}
              <span>{pinned ? "取消置顶" : "置顶"}</span>
            </button>
          )}
          {onEdit && (onLike || onComment || onPin) && <Divider />}
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onEdit();
                closeMenu();
              }}
              className={itemCls}
            >
              <Pencil className={iconCls} strokeWidth={1.8} />
              <span>编辑</span>
            </button>
          )}
          {onDelete && (onLike || onComment || onPin || onEdit) && <Divider />}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete();
                closeMenu();
              }}
              className={itemCls}
            >
              <Trash2 className={iconCls} strokeWidth={1.8} />
              <span>删除</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
