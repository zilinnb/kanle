"use client";

import { useEffect, useState } from "react";
import { useEditPost } from "@/lib/edit-post-store";
import { getCurrentUser } from "@/lib/auth";
import { PublishModal } from "./TopBar";

export default function EditPostModal() {
  const post = useEditPost((s) => s.post);
  const close = useEditPost((s) => s.close);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !post) return null;

  const user = getCurrentUser();
  if (!user?.isLoggedIn || !user.token) return null;

  return (
    <PublishModal
      token={user.token}
      editPost={post}
      onClose={close}
      onPublished={() => {
        // 不直接 close()，由 PublishModal 内部 handleClose 播放退出动画后关闭
        window.dispatchEvent(new CustomEvent("post-published"));
      }}
    />
  );
}
