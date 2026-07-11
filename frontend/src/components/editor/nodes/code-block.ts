import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import CodeBlockNodeView from "../node-views/CodeBlockNodeView";

export const CodeBlock = Node.create({
  name: "codeBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,

  addAttributes() {
    return {
      language: {
        default: "plaintext",
        parseHTML: (element) => {
          const code = element.querySelector("code");
          if (!code) return "plaintext";
          const cls = code.className || "";
          const match = cls.match(/language-(\w+)/);
          return match ? match[1] : "plaintext";
        },
        renderHTML: (attributes) => {
          if (!attributes.language || attributes.language === "plaintext") return {};
          return { "data-language": attributes.language };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: "pre", preserveWhitespace: "full" },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, {
        "data-language": node.attrs.language || "plaintext",
        class: "macos-code-block",
      }),
      [
        "code",
        {
          class: node.attrs.language && node.attrs.language !== "plaintext"
            ? `language-${node.attrs.language}`
            : undefined,
        },
        0,
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },

  addCommands() {
    return {
      setCodeBlock:
        (attributes) =>
        ({ commands }) => {
          return commands.setNode(this.name, attributes);
        },
      toggleCodeBlock:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleNode(this.name, "paragraph", attributes);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-c": () => this.editor.commands.toggleCodeBlock(),
    };
  },
});
