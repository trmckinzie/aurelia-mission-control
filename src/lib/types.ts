export type AgentStatus = "defined" | "idle" | "active" | "paused" | "error";

export interface Agent {
  id: string;
  name: string;
  role: string;
  /** e.g. "ollama/hermes3" — the model intended to drive this agent once wired up. Not executed yet. */
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

export type HermesStatus = "unknown" | "unreachable" | "reachable-no-hermes" | "ready";

export interface HermesStatusResult {
  status: HermesStatus;
  ollamaUrl: string;
  models: string[];
  hermesModels: string[];
  checkedAt: string;
}
