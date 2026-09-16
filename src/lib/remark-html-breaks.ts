import type { Plugin } from "unified";
import type { Root, RootContent } from "mdast";

/**
 * Remark plugin to convert raw `<br>` or `<br/>` HTML tags and text occurrences
 * into standard mdast break nodes so ReactMarkdown renders them as real
 * line breaks (`<br />`), particularly inside markdown table cells and lists.
 */
export const remarkHtmlBreaks: Plugin<[], Root> = () => {
  return (tree: Root) => {
    function visit(node: { children?: RootContent[] }) {
      if (!node || !Array.isArray(node.children)) return;
      const nextChildren: RootContent[] = [];
      for (const child of node.children) {
        if ((child.type === "html" || child.type === "text") && /<br\s*\/?>/i.test(child.value)) {
          const parts = child.value.split(/(<br\s*\/?>)/i);
          for (const part of parts) {
            if (/^<br\s*\/?>$/i.test(part)) {
              nextChildren.push({ type: "break" });
            } else if (part) {
              nextChildren.push({ type: child.type === "html" ? "html" : "text", value: part });
            }
          }
        } else {
          if ("children" in child && Array.isArray(child.children)) {
            visit(child as { children: RootContent[] });
          }
          nextChildren.push(child);
        }
      }
      node.children = nextChildren;
    }
    visit(tree);
  };
};
