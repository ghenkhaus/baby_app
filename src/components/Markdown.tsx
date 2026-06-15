import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

// Configure marked for safe, compact output
marked.setOptions({
  breaks: true, // GFM line breaks
  gfm: true,
});

/** Highlight @mentions before markdown parsing */
function highlightMentions(text: string): string {
  return text.replace(
    /@(\w+)/g,
    '<span class="mention">@$1</span>'
  );
}

interface MarkdownProps {
  content: string;
  className?: string;
  truncate?: boolean;
}

export function Markdown({ content, className = "", truncate = false }: MarkdownProps) {
  const html = useMemo(() => {
    const withMentions = highlightMentions(content);
    const raw = marked.parse(withMentions, { async: false }) as string;
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "em", "del", "a", "code", "pre",
        "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote",
        "span", "hr", "table", "thead", "tbody", "tr", "th", "td",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "class"],
    });
  }, [content]);

  return (
    <div
      className={`markdown-content ${truncate ? "markdown-truncate" : ""} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
