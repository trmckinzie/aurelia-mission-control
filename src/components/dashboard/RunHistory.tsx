"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";
import { RUN_STATUS } from "@/lib/status";
import type { Run } from "@/lib/types";

const POLL_MS = 5000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false });
}

interface RunEntryProps {
  run: Run;
  onArchiveToggle: (run: Run) => void;
  onDelete: (run: Run) => void;
}

function RunEntry({ run, onArchiveToggle, onDelete }: RunEntryProps) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-[var(--border)] bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left font-mono text-[11px] text-muted-foreground">
          <ChevronRight className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="truncate text-foreground/90">{run.agentName}</span>
          <span className="shrink-0 text-muted-foreground/50">→</span>
          <span className="truncate text-foreground/90">{run.goalTitle}</span>
        </CollapsibleTrigger>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden font-mono text-[10px] text-muted-foreground/70 sm:inline">
            {formatTime(run.createdAt)}
          </span>
          <Badge variant="outline" className={RUN_STATUS[run.status].className}>
            {RUN_STATUS[run.status].label}
          </Badge>
          <button
            type="button"
            onClick={() => onArchiveToggle(run)}
            className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            {run.archived ? "Unarchive" : "Archive"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(run)}
            className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-[var(--hud-critical)]"
          >
            Delete
          </button>
        </div>
      </div>
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
  const [view, setView] = useState<"active" | "archived">("active");

  async function load() {
    try {
      const res = await fetch("/api/runs", { cache: "no-store" });
      if (!res.ok) throw new Error("request failed");
      const data: { runs: Run[] } = await res.json();
      setRuns(data.runs);
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      await load();
    }
    initialLoad();

    const interval = setInterval(() => {
      if (!cancelled) load();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshKey]);

  async function toggleArchive(run: Run) {
    setError(false);
    try {
      const res = await fetch(`/api/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !run.archived }),
      });
      if (!res.ok) throw new Error("request failed");
      await load();
    } catch {
      setError(true);
    }
  }

  async function deleteRun(run: Run) {
    const confirmed = window.confirm(
      `Permanently delete this run — "${run.goalTitle}" via ${run.agentName}? This can't be undone.`
    );
    if (!confirmed) return;

    setError(false);
    try {
      const res = await fetch(`/api/runs/${run.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error("request failed");
      await load();
    } catch {
      setError(true);
    }
  }

  if (runs === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const activeRuns = runs.filter((r) => !r.archived);
  const archivedRuns = runs.filter((r) => r.archived);
  const visibleRuns = view === "active" ? activeRuns : archivedRuns;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setView("active")}
          className={`border-b px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
            view === "active"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Active ({activeRuns.length})
        </button>
        <button
          type="button"
          onClick={() => setView("archived")}
          className={`border-b px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
            view === "archived"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Archived ({archivedRuns.length})
        </button>
      </div>

      {error && <p className="text-sm text-[var(--hud-critical)]">Could not load or update run history.</p>}

      {visibleRuns.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {view === "active" ? "No active runs — dispatch something above." : "No archived runs."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleRuns.map((run) => (
            <RunEntry key={run.id} run={run} onArchiveToggle={toggleArchive} onDelete={deleteRun} />
          ))}
        </div>
      )}
    </div>
  );
}
