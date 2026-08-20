import { streamClaudeCodeChat } from "@/lib/providers/claude-code";
import { streamOllamaChat } from "@/lib/providers/ollama";
import { providerIdForModel } from "@/lib/providers/types";
import type { Agent, Goal } from "@/lib/types";

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
 * Turns an Agent + Goal into a chat prompt. Pure and generic on purpose —
 * it works the same for any agent/goal pair, so it doesn't need to change
 * as agents and goals do. `upstream` carries completed sibling-task output
 * for goals with dependencies (see Goal.dependsOnGoalIds) — empty for a
 * goal with no dependencies, so every existing caller is unaffected.
 */
export function buildRunPrompt(agent: Agent, goal: Goal, upstream: UpstreamTaskOutput[] = []): BuiltPrompt {
  const system =
    `You are ${agent.name}, an AI agent. Your role: ${agent.role}. ` +
    "You've been dispatched to work on a specific goal. Respond with a concrete, actionable " +
    "plan or deliverable suited to your role — not a generic acknowledgment.";

  const description = goal.description.trim() || "(no additional description provided)";
  const upstreamBlock =
    upstream.length > 0
      ? "\n\nContext from prior tasks — use this, don't ignore it:\n" +
        upstream.map((u) => `### ${u.title}\n${u.output}`).join("\n\n")
      : "";
  const user =
    `Goal: ${goal.title}\n\n${description}\n\nDomain: ${goal.domain}. Priority: ${goal.priority}.` + upstreamBlock;

  return { system, user };
}
