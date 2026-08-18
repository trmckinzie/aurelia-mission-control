"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface SessionSummary {
  id: string;
  cwd: string | null;
  gitBranch: string | null;
  lastActivity: string;
  sizeBytes: number;
}

const POLL_MS = 5000;
const ACTIVE_WINDOW_MS = 15_000;

function shortId(id: string) {
  return id.slice(0, 8);
}

export function ActiveSessions() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/sessions", { cache: "no-store" });
        if (!res.ok) throw new Error("request failed");
        const data: { sessions: SessionSummary[] } = await res.json();
        if (!cancelled) {
          setSessions(data.sessions);
          setNow(Date.now());
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error) {
    return <p className="font-mono text-[11px] text-[var(--hud-critical)]">Could not load sessions.</p>;
  }
  if (sessions === null) {
    return <p className="font-mono text-[11px] text-muted-foreground">Loading…</p>;
  }
  if (sessions.length === 0) {
    return <p className="font-mono text-[11px] text-muted-foreground">No sessions found for this project yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {sessions.map((s) => {
        const isActive = now !== null && now - new Date(s.lastActivity).getTime() < ACTIVE_WINDOW_MS;
        return (
          <div key={s.id} className="flex items-center justify-between border border-[var(--border)] bg-card px-3 py-2">
            <span className="font-mono text-[11px] text-foreground/90" title={s.id}>
              {shortId(s.id)}
              {s.gitBranch && <span className="text-muted-foreground"> · {s.gitBranch}</span>}
            </span>
            <Badge
              variant="outline"
              className={
                isActive
                  ? "border-[var(--hud-positive)] text-[var(--hud-positive)]"
                  : "border-[var(--border)] text-muted-foreground"
              }
            >
              {isActive ? "active" : "idle"}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
