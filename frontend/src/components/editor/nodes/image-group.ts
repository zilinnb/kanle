import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ImageGroupNodeView from "../node-views/ImageGroupNodeView";

export interface ImageGroupItem {
  src: string;
  alt: string;
}

export const ImageGroup = Node.create({
  name: "imageGroup",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      images: {
        default: [],
        parseHTML: (element: HTMLElement) => {
          const dataImages = element.getAttribute("data-images");
          if (dataImages) {
            try {
              return JSON.parse(decodeURIComponent(atob(dataImages)));
            } catch {
              return [];
            }
          }
          const imgs = element.querySelectorAll("img");
          if (imgs.length > 0) {
            return Array.from(imgs).map((img) => ({
              src: img.getAttribute("src") || "",
              alt: img.getAttribute("alt") || "",
            }));
          }
          return [];
        },
        renderHTML: (attributes: { images?: ImageGroupItem[] }) => {
          if (!attributes.images || attributes.images.length === 0) return {};
          const encoded = btoa(encodeURIComponent(JSON.stringify(attributes.images)));
          return { "data-images": encoded };
        },
      },
      columns: {
        default: 3,
        parseHTML: (element: HTMLElement) => {
          const cols = element.getAttribute("data-columns");
          return cols ? parseInt(cols, 10) : 3;
        },
        renderHTML: (attributes: { columns?: number }) => {
          return { "data-columns": String(attributes.columns || 3) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-image-grid]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const images: ImageGroupItem[] = node.attrs.images || [];
    const columns: number = node.attrs.columns || 3;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-image-grid": "true",
        "data-columns": String(columns),
        contenteditable: "false",
        class: "article-image-grid",
        style: `grid-template-columns: repeat(${columns}, 1fr)`,
      }),
      ...images.map(
        (img: ImageGroupItem) => ["img", { src: img.src, alt: img.alt }] as (string | object)[]
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGroupNodeView);
  },
});
