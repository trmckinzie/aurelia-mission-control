"use client";

import { useState } from "react";
import { ChevronRight, Terminal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ChatMessage } from "@/lib/mock-data";

function TraceLog({ trace }: { trace: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground hover:text-[var(--primary)] transition-colors">
        <ChevronRight className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} />
        <Terminal className="size-3" />
        Chain-of-Thought ({trace.length} steps)
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 border-l border-[var(--border)] pl-3 py-1 flex flex-col gap-1">
        {trace.map((line, i) => (
          <div key={i} className="font-mono text-[11px] text-muted-foreground/80">
            <span className="text-[var(--primary)]/60">{String(i + 1).padStart(2, "0")}</span> {line}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ChatStream({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex flex-col gap-5">
      {messages.map((m) => (
        <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
          <div className="flex items-center gap-2 mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className={m.role === "agent" ? "text-[var(--primary)]" : "text-foreground"}>
              {m.role === "agent" ? "AURELIA" : "OPERATOR"}
            </span>
            <span className="text-muted-foreground/50">{m.timestamp}</span>
          </div>

          <div
            className={`max-w-[85%] border px-4 py-3 text-sm leading-relaxed ${
              m.role === "agent"
                ? "border-[var(--border)] bg-card text-card-foreground"
                : "border-[var(--border)] bg-[var(--secondary)] text-secondary-foreground"
            }`}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return match ? (
                    <SyntaxHighlighter
                      language={match[1]}
                      style={vscDarkPlus}
                      customStyle={{
                        background: "color-mix(in oklab, var(--card) 85%, black)",
                        border: "1px solid var(--border)",
                        borderRadius: 0,
                        fontSize: "12px",
                        margin: "8px 0",
                      }}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className="bg-[var(--muted)] px-1 py-0.5 font-mono text-[12px]" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {m.content}
            </ReactMarkdown>
          </div>

          {m.trace && <TraceLog trace={m.trace} />}
        </div>
      ))}
    </div>
  );
}
