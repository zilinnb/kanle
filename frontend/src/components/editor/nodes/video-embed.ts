import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import VideoEmbedNodeView from "../node-views/VideoEmbedNodeView";

export const VideoEmbed = Node.create({
  name: "videoEmbed",
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
    return [{ tag: 'div[data-embed="video"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-embed": "video",
        "data-payload": HTMLAttributes.payload || "",
        contenteditable: "false",
        class: "embed-block embed-video",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedNodeView);
  },
});
