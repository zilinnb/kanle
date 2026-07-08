import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import LinkCardNodeView from "../node-views/LinkCardNodeView";

export interface LinkCardAttrs {
  href: string;
  title: string;
  description: string;
  image: string;
  siteName?: string;
}

export const LinkCardNode = Node.create({
  name: "linkCard",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      href: { default: "" },
      title: { default: "" },
      description: { default: "" },
      image: { default: "" },
      siteName: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "a.link-card" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const inner: any[] = [];
    if (node.attrs.image) {
      inner.push([
        "span",
        { class: "link-card-image" },
        ["img", { src: node.attrs.image, alt: "" }],
      ]);
    }
    const bodyChildren: any[] = [["span", { class: "link-card-title" }, node.attrs.title]];
    if (node.attrs.description) {
      bodyChildren.push([
        "span",
        { class: "link-card-desc" },
        node.attrs.description,
      ]);
    }
    inner.push(["span", { class: "link-card-body" }, bodyChildren]);

    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href: node.attrs.href,
        target: "_blank",
        rel: "noopener noreferrer",
        class: "link-card",
        contenteditable: "false",
      }),
      inner,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkCardNodeView);
  },
});
