import { Image } from "@tiptap/extension-image";

export const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        renderHTML: (attributes: { class?: string | null }) => {
          if (!attributes.class) return {};
          return { class: attributes.class };
        },
      },
      style: {
        default: null,
        renderHTML: (attributes: { style?: string | null }) => {
          if (!attributes.style) return {};
          return { style: attributes.style };
        },
      },
    };
  },

  // 排除 inline-emoji 类的图片，由 InlineEmoji 节点处理
  parseHTML() {
    return [
      {
        tag: "img[src]:not(.inline-emoji)",
      },
    ];
  },
});
