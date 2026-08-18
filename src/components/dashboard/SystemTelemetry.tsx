import { Activity } from "lucide-react";
import { TokenBudgetCard } from "@/components/dashboard/TokenBudgetCard";
import { TerminalLog } from "@/components/dashboard/TerminalLog";
import { ActiveSessions } from "@/components/dashboard/ActiveSessions";
import { ProvidersPanel } from "@/components/dashboard/ProvidersPanel";
import { PING_MS, TOKEN_BUDGET } from "@/lib/mock-data";

export function SystemTelemetry() {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 border-r border-[var(--border)] bg-background p-4 overflow-y-auto">
      <div>
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
          System Telemetry
        </h2>
        <div className="flex items-center justify-between border border-[var(--border)] bg-card px-3 py-2">
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <Activity className="size-3.5 text-[var(--hud-positive)]" />
            BACKEND LINK
          </span>
          <span className="font-mono text-[11px] tabular-nums text-[var(--hud-positive)]">{PING_MS}ms</span>
        </div>
      </div>

      <TokenBudgetCard {...TOKEN_BUDGET} />

      <div>
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
          AI Providers
        </h2>
        <ProvidersPanel />
      </div>

      <div>
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Claude Code Sessions
        </h2>
        <ActiveSessions />
      </div>

      <div className="mt-auto">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Gateway Log
        </h2>
        <TerminalLog />
      </div>
    </aside>
  );
}
