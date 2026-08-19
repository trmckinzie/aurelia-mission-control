"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LogEvent } from "@/lib/types";

const LEVEL_COLOR: Record<LogEvent["level"], string> = {
  info: "text-[var(--primary)]",
  trace: "text-muted-foreground",
  warn: "text-[var(--hud-warning)]",
  error: "text-[var(--hud-critical)]",
};

const MAX_LINES = 60;
const POLL_MS = 3000;

type Status = "loading" | "live" | "empty" | "error";

const STATUS_LABEL: Record<Status, string> = {
  loading: "CONNECTING",
  live: "LIVE",
  empty: "NO SESSIONS",
  error: "ERROR",
};

export function TerminalLog() {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const offsetRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const sessionsRes = await fetch("/api/sessions", { cache: "no-store" });
        if (!sessionsRes.ok) throw new Error("sessions request failed");
        const { sessions } = (await sessionsRes.json()) as { sessions: { id: string }[] };
        if (cancelled) return;

        if (sessions.length === 0) {
          setStatus("empty");
          return;
        }

        const latestId = sessions[0].id;
        if (latestId !== sessionIdRef.current) {
          sessionIdRef.current = latestId;
          offsetRef.current = undefined;
          setEvents([]);
        }

        const url =
          offsetRef.current === undefined
            ? `/api/sessions/${latestId}/events`
            : `/api/sessions/${latestId}/events?offset=${offsetRef.current}`;
        const eventsRes = await fetch(url, { cache: "no-store" });
        if (!eventsRes.ok) throw new Error("events request failed");
        const data = (await eventsRes.json()) as { events: LogEvent[]; nextOffset: number };
        if (cancelled) return;

        offsetRef.current = data.nextOffset;
        if (data.events.length > 0) {
          setEvents((prev) => [...prev, ...data.events].slice(-MAX_LINES));
        }
        setStatus("live");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [events]);

  return (
    <div className="flex flex-col border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_85%,black)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Session Event Log
        </span>
        <span
          className={`flex items-center gap-1.5 font-mono text-[10px] ${
            status === "live"
              ? "text-[var(--hud-positive)]"
              : status === "error"
                ? "text-[var(--hud-critical)]"
                : "text-muted-foreground"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              status === "live" ? "bg-[var(--hud-positive)] animate-pulse" : "bg-muted-foreground"
            }`}
          />
          {STATUS_LABEL[status]}
        </span>
      </div>
      <ScrollArea className="h-40">
        <div ref={scrollRef} className="flex flex-col gap-0.5 px-3 py-2 font-mono text-[11px] leading-relaxed">
          {events.length === 0 && status !== "loading" && (
            <div className="text-muted-foreground/60">
              {status === "empty"
                ? "No Claude Code sessions found for this project yet."
                : status === "error"
                  ? "Could not reach the session log API."
                  : "Waiting for events…"}
            </div>
          )}
          {events.map((e) => (
            <div key={e.id} className="flex gap-2">
              <span className="shrink-0 text-muted-foreground/60 tabular-nums">{e.timestamp}</span>
              <span className={`shrink-0 uppercase ${LEVEL_COLOR[e.level]}`}>{e.level}</span>
              <span className="shrink-0 text-[var(--accent-foreground)]/70">{e.source}</span>
              <span className="text-foreground/90">{e.message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
