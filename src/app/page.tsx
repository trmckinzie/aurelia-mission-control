import { Radio } from "lucide-react";
import { SystemTelemetry } from "@/components/dashboard/SystemTelemetry";
import { ChatStream } from "@/components/dashboard/ChatStream";
import { ContextCanvas } from "@/components/dashboard/ContextCanvas";
import { CONTEXT_CANVAS_MARKDOWN, INITIAL_MESSAGES } from "@/lib/mock-data";

export default function Home() {
  return (
    <div className="flex h-full min-h-screen w-full flex-col bg-background">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Radio className="size-4 text-[var(--primary)]" />
          <span className="font-heading text-sm font-semibold tracking-wide text-foreground">
            AURELIA
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Mission Control
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[var(--hud-positive)]" />
          Hermes Gateway Connected
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <SystemTelemetry />

        <main className="flex-1 overflow-y-auto px-6 py-5">
          <ChatStream messages={INITIAL_MESSAGES} />
        </main>

        <ContextCanvas markdown={CONTEXT_CANVAS_MARKDOWN} title="testing-effect.md" />
      </div>
    </div>
  );
}
