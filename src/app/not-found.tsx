import Link from "next/link";
import { Radio } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <Radio className="size-8 text-[var(--primary)]" />
      <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Signal Lost
      </div>
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        404 — Route Not Found
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The gateway has no channel mapped to this path.
      </p>
      <Link
        href="/"
        className="mt-2 border border-[var(--border)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--primary)] transition-colors hover:bg-[var(--secondary)]"
      >
        Return to Mission Control
      </Link>
    </div>
  );
}
