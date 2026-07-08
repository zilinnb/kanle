import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import DoubanEmbedNodeView from "../node-views/DoubanEmbedNodeView";

export const DoubanEmbed = Node.create({
  name: "doubanEmbed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      payload: {
        default: "",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-payload") || "",
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.payload) return {};
          return { "data-payload": attributes.payload };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-embed="douban"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-embed": "douban",
        contenteditable: "false",
        class: "embed-block embed-douban",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DoubanEmbedNodeView);
  },
});
