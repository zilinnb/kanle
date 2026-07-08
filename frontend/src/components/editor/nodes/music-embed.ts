import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import MusicEmbedNodeView from "../node-views/MusicEmbedNodeView";

export const MusicEmbed = Node.create({
  name: "musicEmbed",
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
    return [{ tag: 'div[data-embed="music"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-embed": "music",
        contenteditable: "false",
        class: "embed-block embed-music",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MusicEmbedNodeView);
  },
});
