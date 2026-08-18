"use client";

import { useEffect, useState } from "react";
import type { ProviderStatus, ProviderStatusResult } from "@/lib/providers/types";

const LABEL: Record<ProviderStatus, string> = {
  unknown: "Checking Hermes Gateway…",
  unreachable: "Hermes Gateway: Ollama Not Detected",
  degraded: "Hermes Gateway: ",
  ready: "Hermes Gateway Connected",
};

const DOT_CLASS: Record<ProviderStatus, string> = {
  unknown: "bg-muted-foreground",
  unreachable: "bg-muted-foreground",
  degraded: "bg-[var(--hud-warning)]",
  ready: "bg-[var(--hud-positive)]",
};

const POLL_MS = 10000;

export function HermesStatusIndicator() {
  const [status, setStatus] = useState<ProviderStatus>("unknown");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/providers", { cache: "no-store" });
        if (!res.ok) throw new Error("request failed");
        const data: { providers: ProviderStatusResult[] } = await res.json();
        const ollama = data.providers.find((p) => p.id === "ollama");
        if (!cancelled && ollama) {
          setStatus(ollama.status);
          setDetail(ollama.detail);
        }
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
      {status === "degraded" ? `${LABEL.degraded}${detail}` : LABEL[status]}
    </div>
  );
}
