"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DispatchPanel } from "@/components/dashboard/DispatchPanel";
import { RunHistory } from "@/components/dashboard/RunHistory";

export function RunsPageClient() {
  const searchParams = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-lg font-semibold text-foreground mb-1">Dispatch</h1>
        <p className="text-sm text-muted-foreground">
          Send a real goal to a real agent, routed through whichever model it&apos;s configured for.
          Ollama-backed agents stream their response live.
        </p>
      </div>

      <DispatchPanel
        initialGoalId={searchParams.get("goalId") ?? undefined}
        initialAgentId={searchParams.get("agentId") ?? undefined}
        onDispatched={() => setRefreshKey((k) => k + 1)}
      />

      <div>
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Run History</h2>
        <RunHistory refreshKey={refreshKey} />
      </div>
    </div>
  );
}
