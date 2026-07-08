import { Extension } from "@tiptap/core";
import { Suggestion } from "@tiptap/suggestion";
import { slashSuggestion } from "./suggestion";

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addStorage() {
    return {
      openImagePicker: undefined as (() => void) | undefined,
      openLinkPanel: undefined as (() => void) | undefined,
      openLinkCardPanel: undefined as (() => void) | undefined,
      openMusicPanel: undefined as (() => void) | undefined,
      openVideoPanel: undefined as (() => void) | undefined,
      openDoubanPicker: undefined as (() => void) | undefined,
      openArticlePicker: undefined as (() => void) | undefined,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...slashSuggestion,
      }),
    ];
  },
});
