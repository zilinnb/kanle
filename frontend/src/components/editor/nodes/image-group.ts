import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ImageGroupNodeView from "../node-views/ImageGroupNodeView";

export interface ImageGroupItem {
  src: string;
  alt: string;
}

export type ImageGroupLayout = "single" | "double" | "triple" | "grid6" | "grid9";

export function layoutToColumns(layout: ImageGroupLayout): number {
  switch (layout) {
    case "single":
      return 1;
    case "double":
      return 2;
    default:
      return 3;
  }
}

export function layoutMaxImages(layout: ImageGroupLayout): number {
  switch (layout) {
    case "single":
      return 1;
    case "double":
      return 2;
    case "triple":
      return 3;
    case "grid6":
      return 6;
    case "grid9":
      return 9;
  }
}

export function countToLayout(count: number): ImageGroupLayout {
  if (count <= 1) return "single";
  if (count === 2) return "double";
  if (count === 3) return "triple";
  if (count <= 6) return "grid6";
  return "grid9";
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
      layout: {
        default: "triple" as ImageGroupLayout,
        parseHTML: (element: HTMLElement): ImageGroupLayout => {
          const dl = element.getAttribute("data-layout");
          if (dl) return dl as ImageGroupLayout;
          const cols = element.getAttribute("data-columns");
          const c = cols ? parseInt(cols, 10) : 3;
          if (c === 1) return "single";
          if (c === 2) return "double";
          return "triple";
        },
        renderHTML: (attributes: { layout?: ImageGroupLayout }) => {
          return { "data-layout": attributes.layout || "triple" };
        },
      },
      columns: {
        default: 3,
        parseHTML: (element: HTMLElement) => {
          const cols = element.getAttribute("data-columns");
          return cols ? parseInt(cols, 10) : 3;
        },
        renderHTML: (attributes: { columns?: number; layout?: ImageGroupLayout }) => {
          const layout = attributes.layout || "triple";
          return { "data-columns": String(layoutToColumns(layout)) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-image-grid]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const images: ImageGroupItem[] = node.attrs.images || [];
    const layout: ImageGroupLayout = node.attrs.layout || "triple";
    const columns = layoutToColumns(layout);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-image-grid": "true",
        "data-layout": layout,
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
