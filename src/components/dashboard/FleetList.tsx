"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { providerIdForModel } from "@/lib/providers/types";
import { PROJECT_STATUS, isDispatchable } from "@/lib/status";
import { timeAgo } from "@/lib/format";
import type { ProviderStatusResult } from "@/lib/providers/types";
import type { Agent, Project } from "@/lib/types";

export function FleetList() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [providers, setProviders] = useState<ProviderStatusResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [rawIdea, setRawIdea] = useState("");
  const [orchestratorAgentId, setOrchestratorAgentId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const [projectsRes, agentsRes, providersRes] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/agents", { cache: "no-store" }),
        fetch("/api/providers", { cache: "no-store" }),
      ]);
      if (!projectsRes.ok || !agentsRes.ok) throw new Error("request failed");
      const projectsData: { projects: Project[] } = await projectsRes.json();
      const agentsData: { agents: Agent[] } = await agentsRes.json();
      setProjects(projectsData.projects);
      setAgents(agentsData.agents);
      if (providersRes.ok) {
        const providersData: { providers: ProviderStatusResult[] } = await providersRes.json();
        setProviders(providersData.providers);
      }
    } catch {
      setError("Could not load Fleet.");
    }
  }

  useEffect(() => {
    async function initialLoad() {
      await load();
    }
    initialLoad();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!rawIdea.trim() || !orchestratorAgentId) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawIdea, orchestratorAgentId }),
      });
      if (!res.ok) throw new Error("request failed");
      const data: { project: Project } = await res.json();
      router.push(`/fleet/${data.project.id}`);
    } catch {
      setError("Could not start this brain dump.");
      setSubmitting(false);
    }
  }

  if (error) {
    return <p className="text-sm text-[var(--hud-critical)]">{error}</p>;
  }

  if (projects === null || agents === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  // A paused agent is benched — it shouldn't be picked to run a whole project.
  const available = agents.filter(isDispatchable);
  const claudeAgents = available.filter((a) => providerIdForModel(a.model) === "claude-code");
  const otherAgents = available.filter((a) => providerIdForModel(a.model) !== "claude-code");
  const claudeReady = providers.find((p) => p.id === "claude-code")?.status === "ready";
  const claudeGroupLabel = claudeReady ? "Claude Code agents (recommended)" : "Claude Code agents (CLI unreachable)";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-lg font-semibold text-foreground mb-1">Fleet</h1>
        <p className="text-sm text-muted-foreground">
          Blurb an idea, have an orchestrator agent refine it into a brief and task breakdown, review and
          materialize the tasks into real agents and goals, then dispatch and watch them from an org chart.
        </p>
      </div>

      {agents.length === 0 ? (
        <div className="border border-[var(--border)] bg-card p-4 text-sm text-muted-foreground">
          Fleet needs at least one agent to orchestrate with.{" "}
          <Link href="/agents" className="text-[var(--primary)] underline underline-offset-2">
            Create an agent
          </Link>{" "}
          first — a <code className="font-mono">claude-code/&lt;model&gt;</code> agent works best for
          orchestration.
        </div>
      ) : (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 border border-[var(--border)] bg-card p-4">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Brain dump
            </span>
            <textarea
              value={rawIdea}
              onChange={(e) => setRawIdea(e.target.value)}
              placeholder="e.g. a 10-minute YouTube video about optimizing circadian rhythm for energy"
              rows={3}
              className="border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-[var(--primary)]"
            />
          </label>
          <label className="flex flex-col gap-1 sm:max-w-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Orchestrator
            </span>
            <select
              value={orchestratorAgentId}
              onChange={(e) => setOrchestratorAgentId(e.target.value)}
              className="border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-[var(--primary)]"
            >
              <option value="" disabled>
                Select an agent…
              </option>
              {claudeAgents.length > 0 && (
                <optgroup label={claudeGroupLabel}>
                  {claudeAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherAgents.length > 0 && (
                <optgroup label="Other agents">
                  {otherAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <div>
            <Button type="submit" disabled={submitting || !rawIdea.trim() || !orchestratorAgentId}>
              {submitting ? "Starting…" : "Start Brain Dump"}
            </Button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet — start one above.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/fleet/${p.id}`}
              className="flex items-center justify-between gap-3 border border-[var(--border)] bg-card px-4 py-3 hover:border-[var(--primary)]/50"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{p.title || p.rawIdea}</div>
                {p.title && <div className="mt-0.5 truncate text-xs text-muted-foreground">{p.rawIdea}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="font-mono text-[10px] text-muted-foreground/70">{timeAgo(p.createdAt)}</span>
                <Badge variant="outline" className={PROJECT_STATUS[p.status].className}>
                  {PROJECT_STATUS[p.status].label}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
