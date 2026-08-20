"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, History, Plus, Send, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Agent, AgentStatus, Goal, GoalStatus, Run, RunStatus } from "@/lib/types";

const GOAL_STATUSES: GoalStatus[] = ["not-started", "in-progress", "blocked", "done"];
const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  blocked: "Blocked",
  done: "Done",
};
const GOAL_STATUS_STYLE: Record<GoalStatus, string> = {
  "not-started": "border-[var(--border)] text-muted-foreground",
  "in-progress": "border-[var(--hud-positive)] text-[var(--hud-positive)]",
  blocked: "border-[var(--hud-critical)] text-[var(--hud-critical)]",
  done: "border-[var(--primary)] text-[var(--primary)]",
};

const AGENT_STATUSES: AgentStatus[] = ["defined", "idle", "active", "paused", "error"];
const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  defined: "Defined",
  idle: "Idle",
  active: "Active",
  paused: "Paused",
  error: "Error",
};
const AGENT_STATUS_STYLE: Record<AgentStatus, string> = {
  defined: "border-[var(--border)] text-muted-foreground",
  idle: "border-[var(--border)] text-muted-foreground",
  active: "border-[var(--hud-positive)] text-[var(--hud-positive)]",
  paused: "border-[var(--hud-warning)] text-[var(--hud-warning)]",
  error: "border-[var(--hud-critical)] text-[var(--hud-critical)]",
};

const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  running: "Running",
  complete: "Complete",
  error: "Error",
};
const RUN_STATUS_STYLE: Record<RunStatus, string> = {
  running: "border-[var(--hud-positive)] text-[var(--hud-positive)]",
  complete: "border-[var(--primary)] text-[var(--primary)]",
  error: "border-[var(--hud-critical)] text-[var(--hud-critical)]",
};

const RECENT_RUNS_LIMIT = 5;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

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
                  const count = goals.filter((g) => g.status === s).length;
                  if (count === 0) return null;
                  return (
                    <div key={s} className="flex items-center justify-between">
                      <Badge variant="outline" className={GOAL_STATUS_STYLE[s]}>
                        {GOAL_STATUS_LABEL[s]}
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
                  const count = agents.filter((a) => a.status === s).length;
                  if (count === 0) return null;
                  return (
                    <div key={s} className="flex items-center justify-between">
                      <Badge variant="outline" className={AGENT_STATUS_STYLE[s]}>
                        {AGENT_STATUS_LABEL[s]}
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
                  <Badge variant="outline" className={RUN_STATUS_STYLE[run.status]}>
                    {RUN_STATUS_LABEL[run.status]}
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
