import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TokenBudgetCard } from "@/components/dashboard/TokenBudgetCard";
import { TerminalLog } from "@/components/dashboard/TerminalLog";
import { PING_MS, SUB_AGENTS, TOKEN_BUDGET, type SubAgent } from "@/lib/mock-data";

const STATUS_STYLE: Record<SubAgent["status"], string> = {
  idle: "border-[var(--border)] text-muted-foreground",
  running: "border-[var(--hud-positive)] text-[var(--hud-positive)]",
  error: "border-[var(--hud-critical)] text-[var(--hud-critical)]",
};

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
          Active Sub-Agents
        </h2>
        <div className="flex flex-col gap-1.5">
          {SUB_AGENTS.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between border border-[var(--border)] bg-card px-3 py-2"
            >
              <span className="font-mono text-[11px] text-foreground/90">{agent.name}</span>
              <Badge variant="outline" className={STATUS_STYLE[agent.status]}>
                {agent.status}
              </Badge>
            </div>
          ))}
        </div>
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
