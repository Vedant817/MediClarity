/**
 * Turn markdown into speakable plain text for read-aloud. Unlike the list
 * excerpt above, nothing is truncated — but every syntax artifact a speech
 * engine would read literally (table separator rows like `|---|---|` become
 * "dash dash dash") is removed, and table rows become plain sentences.
 */
export function stripMarkdownForSpeech(markdown: unknown): string {
  if (typeof markdown !== "string") return "";
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|[\s(])[*_]([^*_]+)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .split("\n")
    .map((line) => {
      // Table separator row (| --- | --- |) carries no content: drop it.
      if (/^[\s|:\-]+$/.test(line)) return "";
      // Table data row: pipes become pauses, not spoken words.
      if (line.includes("|")) {
        return line
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(", ");
      }
      return line;
    })
    .join("\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_~]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Turn a markdown report summary into a clean one-line-friendly excerpt for
 * list views (dashboard, profile). Full markdown rendering belongs on the
 * dedicated report view; lists must never leak `**`, `#`, `|` or `🔹`.
 */
export function toPlainExcerpt(markdown: unknown, maxChars = 220): string {
  if (typeof markdown !== "string") return "";
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|[\s(])[*_]([^*_]+)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\|/g, " ")
    .replace(/[#*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxChars) return plain;
  const cut = plain.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Caption excerpt for the 3D illustration header: the first meaningful
 * section label plus its opening sentence, joined readably — never a
 * run-on blob and never raw table syntax (separator rows like `|---|---|`
 * previously leaked through toPlainExcerpt as dashes).
 */
export function toCaptionExcerpt(markdown: unknown, maxChars = 320): string {
  const plain = stripMarkdownForSpeech(markdown);
  const blocks = plain
    .split(/\n+/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (blocks.length === 0) return "";
  let caption = blocks[0];
  if (blocks.length > 1 && blocks[0].length < 80 && !/[.!?]$/.test(blocks[0])) {
    caption = `${blocks[0]} — ${blocks[1]}`;
  }
  if (caption.length <= maxChars) return caption;
  const cut = caption.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
