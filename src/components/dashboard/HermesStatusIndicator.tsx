"use client";

import { useEffect, useState } from "react";
import type { ProviderStatus, ProviderStatusResult } from "@/lib/providers/types";

const SHORT_LABEL: Record<string, string> = {
  ollama: "OLLAMA",
  "claude-code": "CLAUDE",
};

const DOT_CLASS: Record<ProviderStatus, string> = {
  unknown: "bg-muted-foreground",
  unreachable: "bg-muted-foreground",
  degraded: "bg-[var(--hud-warning)]",
  ready: "bg-[var(--hud-positive)]",
};

const POLL_MS = 10000;

export function HermesStatusIndicator() {
  const [providers, setProviders] = useState<ProviderStatusResult[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/providers", { cache: "no-store" });
        if (!res.ok) throw new Error("request failed");
        const data: { providers: ProviderStatusResult[] } = await res.json();
        if (!cancelled) setProviders(data.providers);
      } catch {
        if (!cancelled) setProviders(null);
      }
    }

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!providers) {
    return (
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground" />
        Checking providers…
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      {providers.map((p) => (
        <span key={p.id} className="flex items-center gap-1.5" title={`${p.label}: ${p.detail}`}>
          <span className={`size-1.5 rounded-full ${DOT_CLASS[p.status]}`} />
          {SHORT_LABEL[p.id] ?? p.label}
        </span>
      ))}
    </div>
  );
}
