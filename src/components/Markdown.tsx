import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type MarkdownProps = {
  children: string;
  className?: string;
};

/**
 * Single Markdown renderer for the whole app. Enables GitHub Flavored
 * Markdown (tables, strikethrough, task lists) that plain react-markdown
 * drops, and ships one consistent table/heading/list style so AI summaries
 * look the same in dialogs, shares, uploads, and chat. Text color and size
 * inherit from the parent unless overridden via className.
 */
export default function Markdown({ children, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        "[&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:font-semibold",
        "[&_p]:mt-2 [&_li]:ml-4 [&_li]:list-disc",
        "[&_table]:mt-3 [&_table]:w-full [&_table]:border-collapse",
        "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1",
        "[&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-[0.95em]",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
