"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { INITIAL_LOG_EVENTS, nextMockLogEvent, type LogEvent } from "@/lib/mock-data";

const LEVEL_COLOR: Record<LogEvent["level"], string> = {
  info: "text-[var(--primary)]",
  trace: "text-muted-foreground",
  warn: "text-[var(--hud-warning)]",
  error: "text-[var(--hud-critical)]",
};

const MAX_LINES = 40;

export function TerminalLog() {
  const [events, setEvents] = useState<LogEvent[]>(INITIAL_LOG_EVENTS);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulates a Server-Sent Events stream from the Hermes gateway.
    const interval = setInterval(() => {
      setEvents((prev) => [...prev.slice(-MAX_LINES + 1), nextMockLogEvent()]);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [events]);

  return (
    <div className="flex flex-col border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_85%,black)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Event Stream
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--hud-positive)]">
          <span className="size-1.5 rounded-full bg-[var(--hud-positive)] animate-pulse" />
          LIVE
        </span>
      </div>
      <ScrollArea className="h-40">
        <div ref={scrollRef} className="flex flex-col gap-0.5 px-3 py-2 font-mono text-[11px] leading-relaxed">
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
