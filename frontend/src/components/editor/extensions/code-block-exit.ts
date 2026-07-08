import { Extension } from "@tiptap/core";

/**
 * 代码块退出快捷键：
 * - Mod-Enter (Ctrl/Cmd+Enter)
 * - Alt-Enter
 */
export const CodeBlockExit = Extension.create({
  name: "codeBlockExit",

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => this.editor.commands.exitCode(),
      "Alt-Enter": () => this.editor.commands.exitCode(),
    };
  },
});
