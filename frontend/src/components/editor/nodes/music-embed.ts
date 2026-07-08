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
        "data-payload": HTMLAttributes.payload || "",
        contenteditable: "false",
        class: "embed-block embed-music",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MusicEmbedNodeView);
  },
});
