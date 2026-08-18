"use client";

import { FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ContextCanvas({ markdown, title }: { markdown: string; title: string }) {
  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-[var(--border)] bg-background">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <FileText className="size-3.5 text-[var(--primary)]" />
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Active Context — {title}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <article
          className="prose-hud text-sm leading-relaxed text-foreground/90
            [&_h1]:font-heading [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:mb-3
            [&_h2]:font-mono [&_h2]:text-xs [&_h2]:uppercase [&_h2]:tracking-widest [&_h2]:text-[var(--primary)] [&_h2]:mt-5 [&_h2]:mb-2
            [&_h3]:font-mono [&_h3]:text-xs [&_h3]:text-muted-foreground [&_h3]:mt-3 [&_h3]:mb-1
            [&_p]:mb-2 [&_strong]:text-foreground [&_strong]:font-semibold
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2
            [&_a]:text-[var(--primary)] [&_a]:underline [&_a]:underline-offset-2
            [&_code]:bg-[var(--muted)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]
            [&_hr]:border-[var(--border)] [&_hr]:my-4"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      </div>
    </aside>
  );
}
