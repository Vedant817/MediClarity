import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkHtmlBreaks } from "@/lib/remark-html-breaks";
import { cn } from "@/lib/utils";

type MarkdownProps = {
  children: string;
  className?: string;
};

export { remarkHtmlBreaks };

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
        "min-w-0 break-words",
        "[&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:font-semibold",
        "[&_p]:mt-2 [&_p]:break-words [&_li]:ml-4 [&_li]:list-disc",
        "[&_table]:w-full [&_table]:border-collapse",
        "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:align-top",
        "[&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
        "[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:font-mono [&_code]:text-[0.95em] [&_code]:break-words",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkHtmlBreaks]}
        components={{
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3 max-w-full">
              <table {...props} />
            </div>
          ),
        }}
      >
        {children || ""}
      </ReactMarkdown>
    </div>
  );
}
