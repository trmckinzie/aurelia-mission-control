import { Suspense } from "react";
import { RunsPageClient } from "@/components/dashboard/RunsPageClient";

export default function RunsPage() {
  return (
    <main className="flex-1 overflow-y-auto px-6 py-5">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <RunsPageClient />
      </Suspense>
    </main>
  );
}
