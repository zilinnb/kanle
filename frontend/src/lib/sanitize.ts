// HTML 消毒器：基于 DOMParser，允许安全标签与属性，剥离脚本/事件处理器/危险 URL。
// 用于富文本编辑器输出内容与后端返回内容的渲染前过滤，防止 XSS。

import { replaceEmojiShortcodes } from "./emoji";

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "span", "div",
  "hr",
  "img",
  "table", "thead", "tbody", "tr", "th", "td",
]);

// 允许的全局属性（任何标签都可带）
const ALLOWED_GLOBAL_ATTRS = new Set([
  "class", "style", "title", "dir", "lang",
]);

// 标签特定的属性白名单
const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  ol: new Set(["start", "type"]),
  li: new Set(["value"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
};

function isSafeUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.startsWith("javascript:") || v.startsWith("data:text/html") || v.startsWith("vbscript:")) {
    return false;
  }
  return true;
}

function sanitizeStyle(value: string): string {
  // 移除可能用于 XSS 或破坏布局的样式：expression()、url(javascript:...)、position:fixed 等
  if (value.includes("expression(")) return "";
  const cleaned = value
    .replace(/url\(\s*['"]?\s*javascript:[^)]*\)/gi, "")
    .replace(/position\s*:\s*fixed/gi, "position:static")
    .replace(/position\s*:\s*absolute/gi, "position:static");
  return cleaned;
}

function sanitizeNode(node: Element): void {
  // 递归处理子节点（先复制以避免遍历过程中修改影响）
  const children = Array.from(node.children);
  for (const child of children) {
    const tag = child.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      // 不允许的标签：保留其子内容（unwrap），除非是 script/style 等需要整体删除
      if (tag === "script" || tag === "style" || tag === "iframe" || tag === "object" || tag === "embed" || tag === "link" || tag === "meta" || tag === "base" || tag === "form" || tag === "input" || tag === "button" || tag === "textarea" || tag === "select") {
        child.remove();
        continue;
      }
      // 用 fragment 替换，保留子内容
      const frag = node.ownerDocument!.createDocumentFragment();
      while (child.firstChild) frag.appendChild(child.firstChild);
      node.insertBefore(frag, child);
      child.remove();
      continue;
    }

    // 清理属性
    const allowed = ALLOWED_ATTRS_BY_TAG[tag];
    const attrs = Array.from(child.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      // 移除所有 on* 事件属性
      if (name.startsWith("on")) {
        child.removeAttribute(attr.name);
        continue;
      }
      // 允许所有 data-* 属性（惰性数据，无安全风险；用于 embed 占位等）
      if (name.startsWith("data-")) {
        continue;
      }
      // 全局允许
      if (ALLOWED_GLOBAL_ATTRS.has(name)) {
        if (name === "style") {
          const safe = sanitizeStyle(value);
          if (!safe) {
            child.removeAttribute(attr.name);
          } else {
            child.setAttribute("style", safe);
          }
        }
        continue;
      }
      // 标签特定允许
      if (allowed && allowed.has(name)) {
        if ((name === "href" || name === "src") && !isSafeUrl(value)) {
          child.removeAttribute(attr.name);
        }
        continue;
      }
      // 其余属性移除
      child.removeAttribute(attr.name);
    }

    // 对 <a> 强制补 rel="noopener noreferrer" 当 target=_blank
    if (tag === "a") {
      const target = child.getAttribute("target");
      if (target === "_blank") {
        child.setAttribute("rel", "noopener noreferrer");
      }
    }

    // 递归
    sanitizeNode(child);
  }
}

/**
 * 消毒 HTML 字符串，返回仅含白名单标签/属性的安全 HTML。
 * 服务端返回的纯文本（无 HTML 标签）会原样返回。
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  // 快速路径：完全不含 < 字符的纯文本直接返回
  if (html.indexOf("<") === -1) return html;

  if (typeof document === "undefined") return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__root">${html}</div>`, "text/html");
  const root = doc.getElementById("__root");
  if (!root) return "";
  sanitizeNode(root);
  return root.innerHTML;
}

/**
 * 将纯文本转换为可渲染的 HTML：换行转 <br>，HTML 实体转义。
 * 用于向后兼容旧数据（发表时未使用富文本编辑器）。
 */
export function plainTextToHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/**
 * 判断内容是否看起来像 HTML（包含标签），用于决定用 sanitizeHtml 还是 plainTextToHtml。
 */
export function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * 渲染入口：自动判断纯文本或 HTML，返回安全的 HTML 字符串供 dangerouslySetInnerHTML 使用。
 */
export function renderContent(content: string): string {
  if (!content) return "";
  const html = looksLikeHtml(content)
    ? sanitizeHtml(content)
    : plainTextToHtml(content);
  return replaceEmojiShortcodes(html);
}
