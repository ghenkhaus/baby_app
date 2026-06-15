import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Convert a markdown note to plain text suitable for pasting into Postable's
 * message box (which has no formatting). Paragraph breaks and list bullets
 * are preserved; all other markup is dropped.
 */
export function markdownToPlainText(md: string): string {
  // Pass options per-call — don't depend on Markdown.tsx's module-level setOptions.
  const raw = marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
  const html = DOMPurify.sanitize(raw);
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("p, h1, h2, h3, h4, blockquote, pre, tr").forEach((el) => el.append("\n\n"));
  doc.querySelectorAll("li").forEach((el) => {
    el.prepend("- ");
    el.append("\n");
  });
  const text = doc.body.textContent ?? "";
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
