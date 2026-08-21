"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, History, Plus, Send, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AGENT_STATUS, GOAL_STATUS, RUN_STATUS, deriveAgentStatus, deriveGoalStatus } from "@/lib/status";
import { timeAgo } from "@/lib/format";
import type { Agent, AgentStatus, Goal, GoalStatus, Run } from "@/lib/types";

const GOAL_STATUSES: GoalStatus[] = ["not-started", "in-progress", "blocked", "done"];
const AGENT_STATUSES: AgentStatus[] = ["defined", "idle", "active", "paused", "error"];

const RECENT_RUNS_LIMIT = 5;

export function Overview() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [goalsRes, agentsRes, runsRes] = await Promise.all([
          fetch("/api/goals", { cache: "no-store" }),
          fetch("/api/agents", { cache: "no-store" }),
          fetch("/api/runs", { cache: "no-store" }),
        ]);
        if (!goalsRes.ok || !agentsRes.ok || !runsRes.ok) throw new Error("request failed");
        const goalsData: { goals: Goal[] } = await goalsRes.json();
        const agentsData: { agents: Agent[] } = await agentsRes.json();
        const runsData: { runs: Run[] } = await runsRes.json();
        if (!cancelled) {
          setGoals(goalsData.goals);
          setAgents(agentsData.agents);
          setRuns(runsData.runs);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-[var(--hud-critical)]">Could not load mission status.</p>;
  }

  if (goals === null || agents === null || runs === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const isFirstRun = agents.length === 0 && goals.length === 0;
  const recentRuns = runs.slice(0, RECENT_RUNS_LIMIT);

  // A run's goal or agent can be deleted after the fact (Runs deliberately
  // outlive both — see Run's doc comment in src/lib/types.ts) — only link
  // to a specific dispatch context when it still actually exists, otherwise
  // the Runs page silently falls back to whatever's first in the picker.
  const goalIds = new Set(goals.map((g) => g.id));
  const agentIds = new Set(agents.map((a) => a.id));
  function runHref(run: Run): string {
    if (!goalIds.has(run.goalId) || !agentIds.has(run.agentId)) return "/runs";
    return `/runs?goalId=${run.goalId}&agentId=${run.agentId}`;
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-lg font-semibold text-foreground mb-1">Mission Overview</h1>
        <p className="text-sm text-muted-foreground">
          The current state of your agents, goals, and dispatches — at a glance.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/goals" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Plus className="size-3.5" />
          New Goal
        </Link>
        <Link href="/agents" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Plus className="size-3.5" />
          New Agent
        </Link>
        <Link href="/runs" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Send className="size-3.5" />
          Dispatch an Agent
        </Link>
      </div>

      {isFirstRun ? (
        <div className="border border-[var(--border)] bg-card p-5">
          <h2 className="font-heading text-sm font-semibold text-foreground mb-1">Getting started</h2>
          <p className="mb-3 text-sm text-muted-foreground">Three steps to your first real dispatch:</p>
          <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-mono text-[var(--primary)]">1.</span>
              <span>
                <Link href="/agents" className="font-medium text-[var(--primary)] hover:underline">
                  Define an agent
                </Link>{" "}
                — give it a name, a role, and a model (Ollama or the Claude Code CLI).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-[var(--primary)]">2.</span>
              <span>
                <Link href="/goals" className="font-medium text-[var(--primary)] hover:underline">
                  Create a goal
                </Link>{" "}
                and assign the agent to it.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-[var(--primary)]">3.</span>
              <span>
                <Link href="/runs" className="font-medium text-[var(--primary)] hover:underline">
                  Dispatch
                </Link>{" "}
                the goal to the agent and watch it respond live.
              </span>
            </li>
          </ol>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                <Target className="size-3.5" />
                Goals ({goals.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No goals yet —{" "}
                  <Link href="/goals" className="text-[var(--primary)] hover:underline">
                    create one
                  </Link>
                  .
                </p>
              ) : (
                GOAL_STATUSES.map((s) => {
                  const count = goals.filter((g) => deriveGoalStatus(g, runs) === s).length;
                  if (count === 0) return null;
                  return (
                    <div key={s} className="flex items-center justify-between">
                      <Badge variant="outline" className={GOAL_STATUS[s].className}>
                        {GOAL_STATUS[s].label}
                      </Badge>
                      <span className="font-mono text-sm tabular-nums text-foreground/90">{count}</span>
                    </div>
                  );
                })
              )}
              <Link
                href="/goals"
                className="mt-1 text-xs font-medium text-[var(--primary)] hover:underline"
              >
                View all goals →
              </Link>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                <Bot className="size-3.5" />
                Agents ({agents.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No agents yet —{" "}
                  <Link href="/agents" className="text-[var(--primary)] hover:underline">
                    define one
                  </Link>
                  .
                </p>
              ) : (
                AGENT_STATUSES.map((s) => {
                  const count = agents.filter((a) => deriveAgentStatus(a, runs) === s).length;
                  if (count === 0) return null;
                  return (
                    <div key={s} className="flex items-center justify-between">
                      <Badge variant="outline" className={AGENT_STATUS[s].className}>
                        {AGENT_STATUS[s].label}
                      </Badge>
                      <span className="font-mono text-sm tabular-nums text-foreground/90">{count}</span>
                    </div>
                  );
                })
              )}
              <Link
                href="/agents"
                className="mt-1 text-xs font-medium text-[var(--primary)] hover:underline"
              >
                View all agents →
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {!isFirstRun && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              <History className="size-3.5" />
              Recent Runs
            </h2>
            <Link href="/runs" className="text-xs font-medium text-[var(--primary)] hover:underline">
              View all →
            </Link>
          </div>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No runs yet —{" "}
              <Link href="/runs" className="text-[var(--primary)] hover:underline">
                dispatch an agent
              </Link>{" "}
              to get started.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={runHref(run)}
                  className="flex items-center gap-3 border border-[var(--border)] bg-card px-3 py-2.5 hover:border-[var(--primary)]/50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground/90">
                    <span className="font-medium">{run.agentName}</span>
                    <span className="mx-1.5 text-muted-foreground/50">→</span>
                    {run.goalTitle}
                  </span>
                  <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground/70 sm:inline">
                    {timeAgo(run.createdAt)}
                  </span>
                  <Badge variant="outline" className={RUN_STATUS[run.status].className}>
                    {RUN_STATUS[run.status].label}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
