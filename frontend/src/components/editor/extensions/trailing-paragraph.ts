import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * 确保文档末尾有空段落（当最后一个块是 codeBlock 或 atom 节点时）。
 * 解决代码块/embed 后光标卡住无法继续写的问题。
 */
export const TrailingParagraph = Extension.create({
  name: "trailingParagraph",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("trailingParagraph"),
        appendTransaction: (_transactions, _oldState, newState) => {
          const { doc, schema, tr } = newState;
          const last = doc.lastChild;
          if (!last) return null;
          if (last.type.name !== "codeBlock" && !last.isAtom) return null;
          tr.insert(doc.content.size, schema.nodes.paragraph.create());
          return tr;
        },
      }),
    ];
  },
});
