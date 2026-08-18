export type AgentStatus = "defined" | "idle" | "active" | "paused" | "error";

export interface Agent {
  id: string;
  name: string;
  role: string;
  /** e.g. "ollama/hermes3" — the model intended to drive this agent once wired up. Not executed yet. */
  model: string;
  status: AgentStatus;
  goalIds: string[];
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
