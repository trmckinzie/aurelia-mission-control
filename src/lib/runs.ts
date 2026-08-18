import type { Agent, Goal } from "@/lib/types";

export interface BuiltPrompt {
  system: string;
  user: string;
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
