import { streamClaudeCodeChat } from "@/lib/providers/claude-code";
import { streamOllamaChat } from "@/lib/providers/ollama";
import type { Agent, Goal } from "@/lib/types";

export interface BuiltPrompt {
  system: string;
  user: string;
}

const CLAUDE_CODE_PREFIX = "claude-code/";

/**
 * Picks a provider by the agent's model prefix — the one thing that needs
 * to change to add a new dispatch path. Shared by every route that
 * dispatches an agent (POST /api/runs, the Fleet refine step).
 */
export function dispatchAgent(agent: Agent, system: string, user: string): AsyncGenerator<string> {
  if (agent.model.startsWith(CLAUDE_CODE_PREFIX)) {
    return streamClaudeCodeChat(agent.model, system, user);
  }
  return streamOllamaChat(agent.model, [
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
}

/**
 * Turns an Agent + Goal into a chat prompt. Pure and generic on purpose —
 * it works the same for any agent/goal pair, so it doesn't need to change
 * as agents and goals do.
 */
export function buildRunPrompt(agent: Agent, goal: Goal): BuiltPrompt {
  const system =
    `You are ${agent.name}, an AI agent. Your role: ${agent.role}. ` +
    "You've been dispatched to work on a specific goal. Respond with a concrete, actionable " +
    "plan or deliverable suited to your role — not a generic acknowledgment.";

  const description = goal.description.trim() || "(no additional description provided)";
  const user = `Goal: ${goal.title}\n\n${description}\n\nDomain: ${goal.domain}. Priority: ${goal.priority}.`;

  return { system, user };
}
