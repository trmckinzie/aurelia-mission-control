"use client";

import { useState } from "react";
import { ChevronRight, Terminal } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";
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
            <MarkdownContent content={m.content} />
          </div>

          {m.trace && <TraceLog trace={m.trace} />}
        </div>
      ))}
    </div>
  );
}
