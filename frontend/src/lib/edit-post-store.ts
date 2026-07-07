import { create } from "zustand";
import { Post } from "./mock-data";

interface EditPostState {
  /** 正在编辑的动态；为 null 时编辑弹窗关闭 */
  post: Post | null;
  /** 打开编辑弹窗 */
  open: (post: Post) => void;
  /** 关闭编辑弹窗 */
  close: () => void;
}

export const useEditPost = create<EditPostState>((set) => ({
  post: null,
  open: (post) => set({ post }),
  close: () => set({ post: null }),
}));
