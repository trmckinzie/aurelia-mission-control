"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[aurelia] unhandled route error", error);
  }, [error]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <AlertTriangle className="size-8 text-[var(--hud-critical)]" />
      <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Gateway Fault
      </div>
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Something broke on this screen
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The dashboard hit an unexpected error rendering this view. You can
        retry, or reload the page if it keeps happening.
      </p>
      {error.digest && (
        <p className="font-mono text-[11px] text-muted-foreground/60">
          ref: {error.digest}
        </p>
      )}
      <button
        onClick={() => retry()}
        className="mt-2 border border-[var(--hud-critical)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--hud-critical)] transition-colors hover:bg-[var(--hud-critical)]/10"
      >
        Retry
      </button>
    </div>
  );
}
