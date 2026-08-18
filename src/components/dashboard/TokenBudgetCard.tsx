import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";

interface TokenBudgetCardProps {
  spentUsd: number;
  limitUsd: number;
  cachedReadRatio: number;
}

export function TokenBudgetCard({ spentUsd, limitUsd, cachedReadRatio }: TokenBudgetCardProps) {
  const pct = Math.min(100, (spentUsd / limitUsd) * 100);
  const severity = pct >= 90 ? "var(--hud-critical)" : pct >= 60 ? "var(--hud-warning)" : "var(--primary)";

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Monthly API Spend
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between font-mono">
          <span className="text-2xl text-foreground tabular-nums">${spentUsd.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">/ ${limitUsd.toFixed(2)}</span>
        </div>

        <Progress value={pct} className="gap-0">
          <ProgressTrack className="h-1.5 rounded-none bg-[var(--muted)] border border-[var(--border)]">
            <ProgressIndicator
              className="rounded-none transition-all duration-500"
              style={{ backgroundColor: severity }}
            />
          </ProgressTrack>
        </Progress>

        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>CACHED READ RATIO</span>
          <span className="tabular-nums text-[var(--primary)]">{(cachedReadRatio * 100).toFixed(0)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
