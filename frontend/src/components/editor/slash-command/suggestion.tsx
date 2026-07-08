import type { Editor } from "@tiptap/core";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { createRoot, type Root } from "react-dom/client";
import {
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Minus,
  List,
  ListOrdered,
  Image as ImageIcon,
  Link as LinkIcon,
  LayoutTemplate,
  Music,
  Video,
  Film,
  FileText,
} from "lucide-react";
import SlashCommandList, {
  type SlashCommandItem,
  type SlashCommandListRef,
} from "./SlashCommandList";

export interface CommandItem extends SlashCommandItem {
  action: (editor: Editor) => void;
}

export const COMMANDS: CommandItem[] = [
  {
    title: "正文",
    icon: Pilcrow,
    description: "普通段落",
    keywords: "paragraph text body",
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: "标题1",
    icon: Heading1,
    description: "大标题",
    keywords: "heading h1 title",
    action: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    title: "标题2",
    icon: Heading2,
    description: "中标题",
    keywords: "heading h2 title",
    action: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    title: "标题3",
    icon: Heading3,
    description: "小标题",
    keywords: "heading h3 title",
    action: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    title: "引用",
    icon: Quote,
    description: "引用文本",
    keywords: "quote blockquote",
    action: (editor) => editor.chain().focus().setBlockquote().run(),
  },
  {
    title: "代码块",
    icon: Code,
    description: "代码块",
    keywords: "code codeblock pre",
    action: (editor) => editor.chain().focus().setCodeBlock().run(),
  },
  {
    title: "分隔线",
    icon: Minus,
    description: "水平分隔线",
    keywords: "hr horizontal rule divider line",
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: "无序列表",
    icon: List,
    description: "项目列表",
    keywords: "list bullet ul unordered",
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "有序列表",
    icon: ListOrdered,
    description: "编号列表",
    keywords: "list ordered ol numbered",
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "图片",
    icon: ImageIcon,
    description: "上传图片",
    keywords: "image picture photo upload",
    action: (editor) => {
      const storage = (editor.storage as Record<string, any>).slashCommand;
      storage?.openImagePicker?.();
    },
  },
  {
    title: "链接",
    icon: LinkIcon,
    description: "插入超链接",
    keywords: "link url href",
    action: (editor) => {
      const storage = (editor.storage as Record<string, any>).slashCommand;
      storage?.openLinkPanel?.();
    },
  },
  {
    title: "链接卡片",
    icon: LayoutTemplate,
    description: "带预览的链接卡片",
    keywords: "link card url preview",
    action: (editor) => {
      const storage = (editor.storage as Record<string, any>).slashCommand;
      storage?.openLinkCardPanel?.();
    },
  },
  {
    title: "音乐",
    icon: Music,
    description: "插入音乐卡片",
    keywords: "music audio song player",
    action: (editor) => {
      const storage = (editor.storage as Record<string, any>).slashCommand;
      storage?.openMusicPanel?.();
    },
  },
  {
    title: "视频",
    icon: Video,
    description: "插入视频卡片",
    keywords: "video movie player",
    action: (editor) => {
      const storage = (editor.storage as Record<string, any>).slashCommand;
      storage?.openVideoPanel?.();
    },
  },
  {
    title: "豆瓣",
    icon: Film,
    description: "插入豆瓣影单卡片",
    keywords: "douban movie book music film",
    action: (editor) => {
      const storage = (editor.storage as Record<string, any>).slashCommand;
      storage?.openDoubanPicker?.();
    },
  },
  {
    title: "文章卡片",
    icon: FileText,
    description: "引用站内文章",
    keywords: "article post reference card",
    action: (editor) => {
      const storage = (editor.storage as Record<string, any>).slashCommand;
      storage?.openArticlePicker?.();
    },
  },
];

function filterCommands(query: string): CommandItem[] {
  if (!query) return COMMANDS;
  const q = query.toLowerCase();
  return COMMANDS.filter((item) => {
    const title = item.title.toLowerCase();
    const keywords = (item.keywords || "").toLowerCase();
    return title.includes(q) || keywords.includes(q);
  });
}

export const slashSuggestion: Omit<SuggestionOptions<CommandItem>, "editor"> = {
  char: "/",
  startOfLine: false,
  allow: ({ state, range }) => {
    const $from = state.doc.resolve(range.from);
    const type = state.schema.nodes["codeBlock"];
    if (type && $from.parent.type === type) return false;
    return true;
  },

  items: ({ query }) => filterCommands(query),

  command: ({ editor, range, props }) => {
    editor.chain().focus().deleteRange(range).run();
    props.action(editor);
  },

  render: () => {
    let reactRoot: Root | null = null;
    let tippyInstance: TippyInstance | null = null;
    let listRef: SlashCommandListRef | null = null;

    const renderList = (props: SuggestionProps<CommandItem>) => {
      if (!reactRoot) return;

      const onSelect = (item: SlashCommandItem) => {
        const cmd = item as CommandItem;
        props.command({ editor: props.editor, range: props.range, props: cmd });
      };

      reactRoot.render(
        <SlashCommandList
          ref={(ref) => {
            listRef = ref;
          }}
          items={props.items}
          command={onSelect}
        />
      );
    };

    return {
      onStart: (props: SuggestionProps<CommandItem>) => {
        if (typeof document === "undefined") return;

        const container = document.createElement("div");
        reactRoot = createRoot(container);
        renderList(props);

        tippyInstance = tippy(document.body as Element, {
          getReferenceClientRect: () => {
            const rect = props.clientRect?.();
            return rect ?? new DOMRect(0, 0, 0, 0);
          },
          appendTo: () => document.body,
          content: container,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          animation: false,
          maxWidth: "320px",
        }) as unknown as TippyInstance;
      },

      onUpdate: (props: SuggestionProps<CommandItem>) => {
        renderList(props);
        if (tippyInstance && props.clientRect) {
          tippyInstance.setProps({
            getReferenceClientRect: () => {
              const rect = props.clientRect?.();
              return rect ?? new DOMRect(0, 0, 0, 0);
            },
          });
        }
      },

      onKeyDown: (props: { event: KeyboardEvent }) => {
        if (listRef) {
          return listRef.onKeyDown(props.event);
        }
        return false;
      },

      onExit: () => {
        if (tippyInstance) {
          tippyInstance.destroy();
          tippyInstance = null;
        }
        if (reactRoot) {
          reactRoot.unmount();
          reactRoot = null;
        }
        listRef = null;
      },
    };
  },
};
