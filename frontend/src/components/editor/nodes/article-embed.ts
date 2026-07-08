import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ArticleEmbedNodeView from "../node-views/ArticleEmbedNodeView";

export const ArticleEmbed = Node.create({
  name: "articleEmbed",
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
    return [{ tag: 'div[data-embed="article"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-embed": "article",
        "data-payload": HTMLAttributes.payload || "",
        contenteditable: "false",
        class: "embed-block embed-article",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ArticleEmbedNodeView);
  },
});
