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
        "data-payload": HTMLAttributes.payload || "",
        contenteditable: "false",
        class: "embed-block embed-douban",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DoubanEmbedNodeView);
  },
});
