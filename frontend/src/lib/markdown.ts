/**
 * 简易 Markdown → HTML 转换器
 * 支持：标题、粗体/斜体、代码块/行内代码、链接、图片、引用、列表、分隔线、段落
 * 不依赖第三方库，覆盖公众号编辑器常见导入场景。
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function markdownToHtml(md: string): string {
  if (!md) return "";

  const lines = md.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 空行
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 代码块 ```
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const code = escapeHtml(codeLines.join("\n"));
      result.push(`<pre><code class="language-${lang}">${code}</code></pre>`);
      continue;
    }

    // 标题 # ## ### #### ##### ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = inlineFormat(headingMatch[2]);
      result.push(`<h${level}>${text}</h${level}>`);
      i++;
      continue;
    }

    // 分隔线 ---
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      result.push("<hr/>");
      i++;
      continue;
    }

    // 引用 >
    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      result.push(`<blockquote>${inlineFormat(quoteLines.join("<br>"))}</blockquote>`);
      continue;
    }

    // 无序列表 - * +
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${inlineFormat(lines[i].replace(/^\s*[-*+]\s+/, ""))}</li>`);
        i++;
      }
      result.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // 有序列表 1. 2.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inlineFormat(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
        i++;
      }
      result.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // 段落（收集连续非空非特殊行）
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].match(/^(#{1,6})\s+/) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith(">") &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    const paraHtml = inlineFormat(paraLines.join("<br>"));
    result.push(`<p>${paraHtml}</p>`);
  }

  return result.join("\n");
}

/**
 * 行内格式转换：粗体、斜体、行内代码、链接、图片
 */
function inlineFormat(text: string): string {
  let result = text;

  // 图片 ![alt](url) — 先处理图片，避免被链接规则误匹配
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    return `<img src="${url}" alt="${escapeHtml(alt)}" />`;
  });

  // 链接 [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // 行内代码 `code` — 先转义内容
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // 粗斜体 ***text***
  result = result.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");

  // 粗体 **text**
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // 斜体 *text*
  result = result.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  // 删除线 ~~text~~
  result = result.replace(/~~([^~]+)~~/g, "<s>$1</s>");

  return result;
}
