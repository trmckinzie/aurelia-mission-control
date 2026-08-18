"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ProviderStatus, ProviderStatusResult } from "@/lib/providers/types";

const STATUS_STYLE: Record<ProviderStatus, string> = {
  unknown: "border-[var(--border)] text-muted-foreground",
  unreachable: "border-[var(--border)] text-muted-foreground",
  degraded: "border-[var(--hud-warning)] text-[var(--hud-warning)]",
  ready: "border-[var(--hud-positive)] text-[var(--hud-positive)]",
};

const POLL_MS = 10000;

export function ProvidersPanel() {
  const [providers, setProviders] = useState<ProviderStatusResult[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/providers", { cache: "no-store" });
        if (!res.ok) throw new Error("request failed");
        const data: { providers: ProviderStatusResult[] } = await res.json();
        if (!cancelled) {
          setProviders(data.providers);
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
    return <p className="font-mono text-[11px] text-[var(--hud-critical)]">Could not load providers.</p>;
  }
  if (providers === null) {
    return <p className="font-mono text-[11px] text-muted-foreground">Checking…</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {providers.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-2 border border-[var(--border)] bg-card px-3 py-2"
          title={p.detail}
        >
          <span className="truncate font-mono text-[11px] text-foreground/90">{p.label}</span>
          <Badge variant="outline" className={STATUS_STYLE[p.status]}>
            {p.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
