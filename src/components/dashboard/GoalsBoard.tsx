"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GOAL_STATUS, deriveGoalStatus, isDispatchable } from "@/lib/status";
import type { Agent, Goal, GoalDomain, GoalPriority, GoalStatus, Run } from "@/lib/types";

const DOMAINS: { key: GoalDomain; label: string }[] = [
  { key: "productivity", label: "Personal Productivity" },
  { key: "business-process", label: "Business Process" },
  { key: "content", label: "Content Creation" },
];

const STATUSES: GoalStatus[] = ["not-started", "in-progress", "blocked", "done"];

const PRIORITY_STYLE: Record<GoalPriority, string> = {
  low: "border-[var(--border)] text-muted-foreground",
  medium: "border-[var(--hud-warning)] text-[var(--hud-warning)]",
  high: "border-[var(--hud-critical)] text-[var(--hud-critical)]",
};

const NEXT_PRIORITY: Record<GoalPriority, GoalPriority> = {
  low: "medium",
  medium: "high",
  high: "low",
};

export function GoalsBoard() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState<GoalDomain>("productivity");
  const [priority, setPriority] = useState<GoalPriority>("medium");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const [goalsRes, agentsRes, runsRes] = await Promise.all([
        fetch("/api/goals", { cache: "no-store" }),
        fetch("/api/agents", { cache: "no-store" }),
        fetch("/api/runs", { cache: "no-store" }),
      ]);
      if (!goalsRes.ok || !agentsRes.ok) throw new Error("request failed");
      const goalsData: { goals: Goal[] } = await goalsRes.json();
      const agentsData: { agents: Agent[] } = await agentsRes.json();
      setGoals(goalsData.goals);
      setAgents(agentsData.agents);
      if (runsRes.ok) {
        const runsData: { runs: Run[] } = await runsRes.json();
        setRuns(runsData.runs);
      }
    } catch {
      setError("Could not load goals.");
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
    if (!title.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, domain, priority }),
      });
      if (!res.ok) throw new Error("request failed");
      setTitle("");
      setDescription("");
      await load();
    } catch {
      setError("Could not create goal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function patchGoal(id: string, patch: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("request failed");
      await load();
    } catch {
      setError("Could not update goal.");
    }
  }

  function toggleAgent(goal: Goal, agentId: string) {
    const next = goal.agentIds.includes(agentId)
      ? goal.agentIds.filter((id) => id !== agentId)
      : [...goal.agentIds, agentId];
    patchGoal(goal.id, { agentIds: next });
  }

  async function deleteGoal(goal: Goal) {
    const confirmed = window.confirm(`Permanently delete "${goal.title}"? This can't be undone.`);
    if (!confirmed) return;

    setError(null);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error("request failed");
      await load();
    } catch {
      setError("Could not delete goal.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-lg font-semibold text-foreground mb-1">Goals</h1>
        <p className="text-sm text-muted-foreground">
          A goal is one specific deliverable. Assign it to an agent — the reusable specialist that does the
          work — then send it from the Dispatch page. Status updates itself as runs complete.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 border border-[var(--border)] bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Ship weekly newsletter)"
            className="border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-[var(--primary)]"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What should the finished result be? (optional, but agents work better with detail)"
            rows={2}
            className="border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-[var(--primary)] sm:row-span-2"
          />
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as GoalDomain)}
            className="border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-[var(--primary)]"
          >
            {DOMAINS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as GoalPriority)}
            className="border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-[var(--primary)]"
          >
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>
        </div>
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add Goal"}
          </Button>
        </div>
      </form>

      {error && <p className="text-sm text-[var(--hud-critical)]">{error}</p>}

      {goals === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {DOMAINS.map((d) => {
            const domainGoals = goals.filter((g) => g.domain === d.key);
            return (
              <div key={d.key} className="flex flex-col gap-2">
                <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {d.label} <span className="text-muted-foreground/50">({domainGoals.length})</span>
                </h2>
                {domainGoals.length === 0 && (
                  <p className="text-xs text-muted-foreground/70">No goals yet.</p>
                )}
                {domainGoals.map((goal) => {
                  const liveStatus = deriveGoalStatus(goal, runs);
                  return (
                  <div key={goal.id} className="flex flex-col gap-2 border border-[var(--border)] bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{goal.title}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => patchGoal(goal.id, { priority: NEXT_PRIORITY[goal.priority] })}
                          title="Click to cycle priority"
                        >
                          <Badge variant="outline" className={PRIORITY_STYLE[goal.priority]}>
                            {goal.priority}
                          </Badge>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteGoal(goal)}
                          title="Delete goal"
                          className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-[var(--hud-critical)]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {goal.description && (
                      <p className="text-xs text-muted-foreground">{goal.description}</p>
                    )}
                    {goal.projectId && (
                      <Link
                        href={`/fleet/${goal.projectId}`}
                        className="self-start text-[11px] text-[var(--primary)] hover:underline"
                      >
                        From a Fleet project →
                      </Link>
                    )}

                    <div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                          Status
                        </span>
                        <Badge variant="outline" className={GOAL_STATUS[liveStatus].className}>
                          {GOAL_STATUS[liveStatus].label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => patchGoal(goal.id, { status: s })}
                            disabled={liveStatus === s}
                            title={`Mark this goal ${GOAL_STATUS[s].label}`}
                            className={`border px-1.5 py-0.5 text-[10px] ${
                              liveStatus === s
                                ? GOAL_STATUS[s].className
                                : "border-[var(--border)] text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {GOAL_STATUS[s].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-1 border-t border-[var(--border)] pt-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                          Assigned agents
                        </span>
                        {goal.agentIds.length > 0 && (
                          <Link
                            href={`/runs?goalId=${goal.id}&agentId=${goal.agentIds[0]}`}
                            className="text-[11px] font-medium text-[var(--primary)] hover:underline"
                          >
                            Dispatch →
                          </Link>
                        )}
                      </div>
                      {agents.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground/60">
                          No agents defined yet — add some on the Agents page.
                        </p>
                      ) : (
                        <>
                          {goal.agentIds.length === 0 && (
                            <p className="mb-1 text-[11px] text-[var(--hud-warning)]">
                              Unassigned — pick an agent below to dispatch this.
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {agents.filter(isDispatchable).map((agent) => {
                              const assigned = goal.agentIds.includes(agent.id);
                              return (
                                <button
                                  key={agent.id}
                                  type="button"
                                  onClick={() => toggleAgent(goal, agent.id)}
                                  title={`${agent.role} · ${agent.model}`}
                                  className={`border px-1.5 py-0.5 text-[10px] ${
                                    assigned
                                      ? "border-[var(--primary)] text-[var(--primary)]"
                                      : "border-[var(--border)] text-muted-foreground/70 hover:text-foreground"
                                  }`}
                                >
                                  {agent.name}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
