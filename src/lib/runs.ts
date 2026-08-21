import { streamClaudeCodeChat } from "@/lib/providers/claude-code";
import { streamOllamaChat } from "@/lib/providers/ollama";
import { providerIdForModel } from "@/lib/providers/types";
import type { Agent, Goal, Run } from "@/lib/types";

export interface BuiltPrompt {
  system: string;
  user: string;
}

/**
 * Picks a provider by the agent's model prefix — the one thing that needs
 * to change to add a new dispatch path. Shared by every route that
 * dispatches an agent (POST /api/runs, the Fleet refine step).
 */
export function dispatchAgent(agent: Agent, system: string, user: string): AsyncGenerator<string> {
  if (providerIdForModel(agent.model) === "claude-code") {
    return streamClaudeCodeChat(agent.model, system, user);
  }
  return streamOllamaChat(agent.model, [
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
}

export interface UpstreamTaskOutput {
  title: string;
  output: string;
}

/**
 * Resolves a goal's dependencies to their most recent *complete* run output.
 * A dependency without a completed run yet is just omitted — dispatch is
 * never blocked server-side, the org chart is what informs the user. Picks
 * the most recent complete run per dependency rather than the first match —
 * `runs` is typically in append order (oldest first), so a plain `.find()`
 * would keep resolving to a goal's original run forever, even after a
 * corrected re-dispatch superseded it (confirmed live: a downstream task
 * kept citing a since-fixed dependency's stale, failed output).
 */
export function resolveUpstream(goal: Goal, goals: Goal[], runs: Run[]): UpstreamTaskOutput[] {
  return (goal.dependsOnGoalIds ?? [])
    .map((depId) => {
      const depGoal = goals.find((g) => g.id === depId);
      const depRun = runs
        .filter((r) => r.goalId === depId && r.status === "complete")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return depGoal && depRun ? { title: depGoal.title, output: depRun.response } : null;
    })
    .filter((u): u is UpstreamTaskOutput => u !== null);
}

/**
 * Turns an Agent + Goal into a chat prompt. Pure and generic on purpose —
 * it works the same for any agent/goal pair, so it doesn't need to change
 * as agents and goals do. `upstream` carries completed sibling-task output
 * for goals with dependencies (see Goal.dependsOnGoalIds) — empty for a
 * goal with no dependencies, so every existing caller is unaffected.
 * `projectBrief` carries the parent Project's refined brief (source data,
 * context) for a goal materialized from a Fleet project — a task's own
 * description is just its instruction ("produce a variance table..."), the
 * actual data being worked on lives only in the brief, so without this a
 * project-derived task is dispatched with instructions but no material to
 * act on (confirmed live: a budget-analysis task given no numbers
 * hallucinated a fake file search rather than reporting it had nothing to
 * work with).
 */
export function buildRunPrompt(
  agent: Agent,
  goal: Goal,
  upstream: UpstreamTaskOutput[] = [],
  projectBrief?: string
): BuiltPrompt {
  const system =
    `You are ${agent.name}, an AI agent. Your role: ${agent.role}. ` +
    "You've been dispatched to work on a specific goal. Respond with a concrete, actionable " +
    "plan or deliverable suited to your role — not a generic acknowledgment.";

  const description = goal.description.trim() || "(no additional description provided)";
  const briefBlock = projectBrief?.trim()
    ? `\n\nProject brief — background and source data this task is part of:\n${projectBrief.trim()}`
    : "";
  const upstreamBlock =
    upstream.length > 0
      ? "\n\nContext from prior tasks — use this, don't ignore it:\n" +
        upstream.map((u) => `### ${u.title}\n${u.output}`).join("\n\n")
      : "";
  const user =
    `Goal: ${goal.title}\n\n${description}\n\nDomain: ${goal.domain}. Priority: ${goal.priority}.` +
    briefBlock +
    upstreamBlock;

  return { system, user };
}
