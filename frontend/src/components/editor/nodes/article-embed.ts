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
        parseHTML: (element: HTMLElement) => element.getAttribute("data-payload") || "",
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.payload) return {};
          return { "data-payload": attributes.payload };
        },
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
        contenteditable: "false",
        class: "embed-block embed-article",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ArticleEmbedNodeView);
  },
});
