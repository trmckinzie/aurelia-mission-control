import { TerminalLog } from "@/components/dashboard/TerminalLog";
import { ActiveSessions } from "@/components/dashboard/ActiveSessions";
import { ProvidersPanel } from "@/components/dashboard/ProvidersPanel";

export function SystemTelemetry() {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 border-r border-[var(--border)] bg-background p-4 overflow-y-auto">
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
        <p className="mb-2 text-[11px] text-muted-foreground/70">
          This project&apos;s own build conversations — not a dispatch target. For the Claude Code CLI as an
          agent backend, see AI Providers above.
        </p>
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
