import type { Agent, AgentStatus, Goal, GoalStatus, ProjectStatus, Run, RunStatus } from "@/lib/types";

/**
 * One display vocabulary for every status enum in the app. Before this,
 * eight near-identical style maps lived across seven dashboard components
 * and had already drifted — Overview showed "Not Started" while Goals showed
 * the raw `not-started`. Same de-duplication reasoning as
 * providerIdForModel in src/lib/providers/types.ts: one definition, imported
 * everywhere, so a status can't render two different ways on two pages.
 */
export interface StatusDisplay {
  label: string;
  className: string;
}

const NEUTRAL = "border-[var(--border)] text-muted-foreground";
const POSITIVE = "border-[var(--hud-positive)] text-[var(--hud-positive)]";
const WARNING = "border-[var(--hud-warning)] text-[var(--hud-warning)]";
const CRITICAL = "border-[var(--hud-critical)] text-[var(--hud-critical)]";
const DONE = "border-[var(--primary)] text-[var(--primary)]";

export const GOAL_STATUS: Record<GoalStatus, StatusDisplay> = {
  "not-started": { label: "Not Started", className: NEUTRAL },
  "in-progress": { label: "In Progress", className: POSITIVE },
  blocked: { label: "Blocked", className: CRITICAL },
  done: { label: "Done", className: DONE },
};

export const AGENT_STATUS: Record<AgentStatus, StatusDisplay> = {
  defined: { label: "Defined", className: NEUTRAL },
  idle: { label: "Idle", className: NEUTRAL },
  active: { label: "Active", className: POSITIVE },
  paused: { label: "Paused", className: WARNING },
  error: { label: "Error", className: CRITICAL },
};

export const RUN_STATUS: Record<RunStatus, StatusDisplay> = {
  running: { label: "Running", className: POSITIVE },
  complete: { label: "Complete", className: DONE },
  error: { label: "Error", className: CRITICAL },
};

export const PROJECT_STATUS: Record<ProjectStatus, StatusDisplay> = {
  draft: { label: "Draft", className: NEUTRAL },
  refining: { label: "Refining", className: WARNING },
  refined: { label: "Refined", className: DONE },
  planned: { label: "Planned", className: POSITIVE },
  error: { label: "Error", className: CRITICAL },
};

/** Explains what each agent status means — these controls gate dispatch, so the meaning has to be visible. */
export const AGENT_STATUS_HELP: Record<AgentStatus, string> = {
  defined: "Created but never dispatched.",
  idle: "Ready to dispatch.",
  active: "Currently running a dispatch.",
  paused: "Benched — excluded from dispatch and from the orchestrator's roster.",
  error: "Its last dispatch failed.",
};

/** Paused agents are deliberately excluded from every dispatch path — see AGENT_STATUS_HELP. */
export function isDispatchable(agent: Pick<Agent, "status">): boolean {
  return agent.status !== "paused";
}

/**
 * Live goal status from run history, rather than the stored field alone.
 * The stored value is only ever what someone last clicked — nothing
 * advanced it automatically, so a goal whose four tasks had all completed
 * still read "Not Started" everywhere except the Fleet org chart (which
 * derived it correctly). This makes every page agree with that derivation.
 * A stored `blocked` is respected as a deliberate manual flag; everything
 * else defers to what the runs actually show.
 */
export function deriveGoalStatus(goal: Pick<Goal, "id" | "status">, runs: Run[]): GoalStatus {
  const forGoal = runs
    .filter((r) => r.goalId === goal.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (forGoal.length === 0) return goal.status;
  if (forGoal.some((r) => r.status === "running")) return "in-progress";
  if (goal.status === "blocked") return "blocked";
  const latest = forGoal[0];
  if (latest.status === "complete") return "done";
  if (latest.status === "error") return "blocked";
  return goal.status;
}

/** Live agent status — "active" whenever it has a run in flight, otherwise the stored value. */
export function deriveAgentStatus(agent: Pick<Agent, "id" | "status">, runs: Run[]): AgentStatus {
  if (agent.status === "paused") return "paused";
  if (runs.some((r) => r.agentId === agent.id && r.status === "running")) return "active";
  return agent.status;
}
