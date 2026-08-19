export type AgentStatus = "defined" | "idle" | "active" | "paused" | "error";

export interface Agent {
  id: string;
  name: string;
  role: string;
  /** e.g. "ollama/hermes3" (dispatched to Ollama) or "claude-code/sonnet" (dispatched to the Claude Code CLI). */
  model: string;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}

export type GoalDomain = "productivity" | "business-process" | "content";
export type GoalStatus = "not-started" | "in-progress" | "blocked" | "done";
export type GoalPriority = "low" | "medium" | "high";

export interface Goal {
  id: string;
  title: string;
  description: string;
  domain: GoalDomain;
  status: GoalStatus;
  priority: GoalPriority;
  /** Agents assigned to this goal — the goal is the single source of truth for the relationship. */
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type RunStatus = "running" | "complete" | "error";

/** A real dispatch of one Agent against one Goal to a model. Agent/goal name are
 * snapshotted at dispatch time so history still reads sensibly if either is
 * later renamed or deleted. */
export interface Run {
  id: string;
  agentId: string;
  agentName: string;
  goalId: string;
  goalTitle: string;
  model: string;
  status: RunStatus;
  prompt: string;
  response: string;
  error?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
