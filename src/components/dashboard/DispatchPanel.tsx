"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";
import { agentProviderStatus, providerIdForModel } from "@/lib/providers/types";
import type { ProviderStatusResult } from "@/lib/providers/types";
import type { Agent, Goal, RunStatus } from "@/lib/types";

const STATUS_STYLE: Record<RunStatus, string> = {
  running: "border-[var(--hud-positive)] text-[var(--hud-positive)]",
  complete: "border-[var(--primary)] text-[var(--primary)]",
  error: "border-[var(--hud-critical)] text-[var(--hud-critical)]",
};

interface RunMeta {
  agentName: string;
  goalTitle: string;
  model: string;
}

interface DispatchPanelProps {
  initialGoalId?: string;
  initialAgentId?: string;
  onDispatched?: () => void;
}

export function DispatchPanel({ initialGoalId, initialAgentId, onDispatched }: DispatchPanelProps) {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [providers, setProviders] = useState<ProviderStatusResult[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [agentId, setAgentId] = useState(initialAgentId ?? "");
  const [goalId, setGoalId] = useState(initialGoalId ?? "");

  const [status, setStatus] = useState<RunStatus | "idle">("idle");
  const [output, setOutput] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [runMeta, setRunMeta] = useState<RunMeta | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [agentsRes, goalsRes, providersRes] = await Promise.all([
          fetch("/api/agents", { cache: "no-store" }),
          fetch("/api/goals", { cache: "no-store" }),
          fetch("/api/providers", { cache: "no-store" }),
        ]);
        if (!agentsRes.ok || !goalsRes.ok) throw new Error("request failed");
        const agentsData: { agents: Agent[] } = await agentsRes.json();
        const goalsData: { goals: Goal[] } = await goalsRes.json();
        setAgents(agentsData.agents);
        setGoals(goalsData.goals);
        if (providersRes.ok) {
          const providersData: { providers: ProviderStatusResult[] } = await providersRes.json();
          setProviders(providersData.providers);
        }
      } catch {
        setLoadError(true);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    const interval = setInterval(() => {
      if (startTimeRef.current !== null) setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
    return () => clearInterval(interval);
  }, [status]);

  async function dispatch() {
    const agent = agents?.find((a) => a.id === agentId);
    const goal = goals?.find((g) => g.id === goalId);
    if (!agent || !goal) return;

    setStatus("running");
    setOutput("");
    setRunError(null);
    setRunMeta({ agentName: agent.name, goalTitle: goal.title, model: agent.model });
    startTimeRef.current = Date.now();
    setElapsedMs(0);

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, goalId }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Dispatch failed" }));
        setRunError(typeof data.error === "string" ? data.error : "Dispatch failed");
        setStatus("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setOutput(text);
      }
      setStatus("complete");
      onDispatched?.();
    } catch {
      setRunError("Connection to the dispatch stream was lost.");
      setStatus("error");
    }
  }

  if (loadError) {
    return <p className="text-sm text-[var(--hud-critical)]">Could not load agents or goals.</p>;
  }

  if (agents === null || goals === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (agents.length === 0 || goals.length === 0) {
    return (
      <div className="border border-[var(--border)] bg-card p-4 text-sm text-muted-foreground">
        Dispatch needs at least one agent and one goal.{" "}
        {agents.length === 0 && (
          <Link href="/agents" className="text-[var(--primary)] underline underline-offset-2">
            Create an agent
          </Link>
        )}
        {agents.length === 0 && goals.length === 0 && " and "}
        {goals.length === 0 && (
          <Link href="/goals" className="text-[var(--primary)] underline underline-offset-2">
            create a goal
          </Link>
        )}{" "}
        first.
      </div>
    );
  }

  const displayStatus: RunStatus = status === "idle" ? "running" : status;
  const selectedGoal = goals.find((g) => g.id === goalId);
  const assignedAgents = selectedGoal ? agents.filter((a) => selectedGoal.agentIds.includes(a.id)) : [];
  const otherAgents = selectedGoal ? agents.filter((a) => !selectedGoal.agentIds.includes(a.id)) : agents;

  const selectedAgent = agents.find((a) => a.id === agentId);
  const selectedAgentProviderStatus = selectedAgent ? agentProviderStatus(selectedAgent.model, providers) : "unknown";
  const selectedAgentProviderLabel = selectedAgent
    ? (providers.find((p) => p.id === providerIdForModel(selectedAgent.model))?.label ??
      providerIdForModel(selectedAgent.model))
    : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 border border-[var(--border)] bg-card p-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Goal</span>
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-[var(--primary)]"
          >
            <option value="" disabled>
              Select a goal…
            </option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Agent</span>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-[var(--primary)]"
          >
            <option value="" disabled>
              Select an agent…
            </option>
            {assignedAgents.length > 0 ? (
              <>
                <optgroup label="Assigned to this goal">
                  {assignedAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
                {otherAgents.length > 0 && (
                  <optgroup label="Other agents">
                    {otherAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </>
            ) : (
              otherAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))
            )}
          </select>
        </label>
        <Button onClick={dispatch} disabled={!agentId || !goalId || status === "running"}>
          {status === "running" ? "Dispatching…" : "Dispatch"}
        </Button>
      </div>

      {selectedAgent && selectedAgentProviderStatus !== "ready" && (
        <p className="text-xs text-[var(--hud-warning)]">
          ⚠ {selectedAgentProviderLabel} is currently {selectedAgentProviderStatus} — dispatch will likely fail.
        </p>
      )}

      {runMeta && (
        <div className="flex flex-col border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_85%,black)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <span className="text-foreground/90">{runMeta.agentName}</span>
              <span className="text-muted-foreground/50">→</span>
              <span className="text-foreground/90">{runMeta.goalTitle}</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{runMeta.model}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {(elapsedMs / 1000).toFixed(1)}s
              </span>
              <Badge variant="outline" className={STATUS_STYLE[displayStatus]}>
                {status}
              </Badge>
            </div>
          </div>

          <div className="max-h-[440px] overflow-y-auto px-4 py-3">
            {status === "running" && (
              <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-foreground/90">
                {output}
                <span className="cursor-blink text-[var(--primary)]">▊</span>
              </div>
            )}
            {status === "error" && (
              <div className="text-sm text-[var(--hud-critical)]">
                {output && (
                  <div className="mb-2 whitespace-pre-wrap font-mono text-[13px] text-foreground/70">{output}</div>
                )}
                {runError}
              </div>
            )}
            {status === "complete" && (
              <div className="text-sm leading-relaxed text-foreground/90">
                <MarkdownContent content={output} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
