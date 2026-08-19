"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Run } from "@/lib/types";

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Overview" },
  { href: "/agents", label: "Agents" },
  { href: "/goals", label: "Goals" },
  { href: "/runs", label: "Runs" },
];

const POLL_MS = 5000;

export function NavBar() {
  const pathname = usePathname();
  const [hasActiveRun, setHasActiveRun] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/runs", { cache: "no-store" });
        if (!res.ok) throw new Error("request failed");
        const data: { runs: Run[] } = await res.json();
        if (!cancelled) setHasActiveRun(data.runs.some((r) => r.status === "running"));
      } catch {
        // Leave the last known state — a transient poll failure shouldn't flip the indicator off.
      }
    }

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <nav className="flex items-center gap-1 border-b border-[var(--border)] px-4 py-1.5">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-1.5 border-b px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest transition-colors ${
              active
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {link.label}
            {link.href === "/runs" && hasActiveRun && (
              <span
                className="size-1.5 rounded-full bg-[var(--hud-positive)] animate-pulse"
                title="A run is in progress"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
