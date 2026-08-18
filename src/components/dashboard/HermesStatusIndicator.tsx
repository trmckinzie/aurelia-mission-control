"use client";

import { useEffect, useState } from "react";
import type { HermesStatus } from "@/lib/types";

const LABEL: Record<HermesStatus, string> = {
  unknown: "Checking Hermes Gateway…",
  unreachable: "Hermes Gateway: Ollama Not Detected",
  "reachable-no-hermes": "Hermes Gateway: No Hermes Model Pulled",
  ready: "Hermes Gateway Connected",
};

const DOT_CLASS: Record<HermesStatus, string> = {
  unknown: "bg-muted-foreground",
  unreachable: "bg-muted-foreground",
  "reachable-no-hermes": "bg-[var(--hud-warning)]",
  ready: "bg-[var(--hud-positive)]",
};

const POLL_MS = 10000;

export function HermesStatusIndicator() {
  const [status, setStatus] = useState<HermesStatus>("unknown");

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/hermes/status", { cache: "no-store" });
        if (!res.ok) throw new Error("request failed");
        const data: { status: HermesStatus } = await res.json();
        if (!cancelled) setStatus(data.status);
      } catch {
        if (!cancelled) setStatus("unreachable");
      }
    }

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      <span className={`size-1.5 rounded-full ${DOT_CLASS[status]}`} />
      {LABEL[status]}
    </div>
  );
}
