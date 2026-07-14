"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { Check, Copy } from "lucide-react";

const LANGUAGES = [
  "plaintext", "javascript", "typescript", "jsx", "tsx",
  "html", "css", "json", "bash", "shell",
  "python", "java", "go", "rust", "c", "cpp",
  "sql", "yaml", "markdown", "xml", "php", "ruby",
];

const LANG_LABELS: Record<string, string> = {
  plaintext: "纯文本",
  javascript: "JavaScript",
  typescript: "TypeScript",
  jsx: "JSX",
  tsx: "TSX",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  bash: "Bash",
  shell: "Shell",
  python: "Python",
  java: "Java",
  go: "Go",
  rust: "Rust",
  c: "C",
  cpp: "C++",
  sql: "SQL",
  yaml: "YAML",
  markdown: "Markdown",
  xml: "XML",
  php: "PHP",
  ruby: "Ruby",
};

export default function CodeBlockNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const language = (node.attrs.language as string) || "plaintext";

  const handleCopy = useCallback(() => {
    const text = node.textContent || "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [node]);

  return (
    <NodeViewWrapper as="div" className="macos-code-wrapper">
      <div className={`macos-code-container ${selected ? "is-selected" : ""}`}>
        {/* 标题栏：macOS 风格 */}
        <div className="macos-code-header" contentEditable={false}>
          <div className="macos-traffic-lights">
            <span className="macos-traffic-light macos-traffic-red" />
            <span className="macos-traffic-light macos-traffic-yellow" />
            <span className="macos-traffic-light macos-traffic-green" />
          </div>
          <select
            className="macos-lang-select"
            value={language}
            onChange={(e) => updateAttributes({ language: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            contentEditable={false}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANG_LABELS[lang] || lang}
              </option>
            ))}
          </select>
          <button
            className="macos-copy-btn"
            onClick={handleCopy}
            onMouseDown={(e) => e.stopPropagation()}
            contentEditable={false}
            title="复制代码"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>已复制</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>复制</span>
              </>
            )}
          </button>
        </div>
        {/* 代码区域 */}
        <div className="macos-code-body">
          <NodeViewContent as="div" className="macos-code-content" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
