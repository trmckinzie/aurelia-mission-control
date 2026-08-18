"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";
import type { Run, RunStatus } from "@/lib/types";

const STATUS_STYLE: Record<RunStatus, string> = {
  running: "border-[var(--hud-positive)] text-[var(--hud-positive)]",
  complete: "border-[var(--primary)] text-[var(--primary)]",
  error: "border-[var(--hud-critical)] text-[var(--hud-critical)]",
};

const POLL_MS = 5000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false });
}

function RunEntry({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-[var(--border)] bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left">
        <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <ChevronRight className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="text-foreground/90">{run.agentName}</span>
          <span className="text-muted-foreground/50">→</span>
          <span className="truncate text-foreground/90">{run.goalTitle}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground/70">{formatTime(run.createdAt)}</span>
          <Badge variant="outline" className={STATUS_STYLE[run.status]}>
            {run.status}
          </Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-[var(--border)] px-4 py-3">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          {run.model} · prompt
        </div>
        <div className="mb-3 whitespace-pre-wrap border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_85%,black)] px-3 py-2 font-mono text-[12px] text-foreground/80">
          {run.prompt}
        </div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Response</div>
        {run.status === "error" ? (
          <p className="text-sm text-[var(--hud-critical)]">{run.error ?? "Unknown error"}</p>
        ) : run.response ? (
          <div className="text-sm leading-relaxed text-foreground/90">
            <MarkdownContent content={run.response} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No response yet.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RunHistory({ refreshKey }: { refreshKey?: number }) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/runs", { cache: "no-store" });
        if (!res.ok) throw new Error("request failed");
        const data: { runs: Run[] } = await res.json();
        if (!cancelled) {
          setRuns(data.runs);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshKey]);

  if (error) {
    return <p className="text-sm text-[var(--hud-critical)]">Could not load run history.</p>;
  }
  if (runs === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No runs yet — dispatch something above.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {runs.map((run) => (
        <RunEntry key={run.id} run={run} />
      ))}
    </div>
  );
}
