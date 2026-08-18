import { Radio } from "lucide-react";
import { HermesStatusIndicator } from "@/components/dashboard/HermesStatusIndicator";

export function Header() {
  return (
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
      <HermesStatusIndicator />
    </header>
  );
}
