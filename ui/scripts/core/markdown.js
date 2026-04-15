import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/+esm";

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: false,
  mangle: false
});

export function renderMarkdown(markdownText) {
  const rawHtml = marked.parse(String(markdownText || ""));
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true }
  });
}
