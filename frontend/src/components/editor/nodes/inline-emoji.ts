import { Node, mergeAttributes } from "@tiptap/core";

/**
 * 行内表情节点 — 与文字同行显示，不独占一行。
 * Tiptap 默认的 Image 是块级节点（group: "block"），表情用 Image 会换行。
 * 此节点为 inline + atom，通过 img.inline-emoji 选择器与普通图片区分。
 */
export const InlineEmoji = Node.create({
  name: "inlineEmoji",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      class: { default: "inline-emoji" },
    };
  },

  parseHTML() {
    return [{ tag: "img.inline-emoji" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { class: "inline-emoji" })];
  },
});
