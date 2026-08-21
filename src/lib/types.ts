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
  /** Set when this goal was generated from a Fleet Project's task plan. */
  projectId?: string;
  /** Other goals (usually sibling Fleet tasks) whose latest complete Run output gets injected as context when this goal is dispatched. */
  dependsOnGoalIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LogEvent {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "trace";
  source: string;
  message: string;
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

export type ProjectStatus = "draft" | "refining" | "refined" | "planned" | "error";

/**
 * One task proposed by the orchestrator's refinement pass — not yet a real
 * Goal. A task is *work*, so it names an existing specialist Agent to do it
 * rather than describing a new one: an Agent is a reusable "who" (Code
 * Specialist, kept across projects), a Goal is one project's "what". An
 * earlier version built both from this same title/description pair, which
 * made every agent an exact clone of its goal and filled the registry with
 * single-use, task-named agents.
 */
export interface ProposedTask {
  title: string;
  description: string;
  /** Name of an existing Agent to do this work, resolved to Goal.agentIds at materialization. Null/unmatched means unassigned — the user picks during review; nothing is auto-created. */
  assignee?: string | null;
  /** Only meaningful for an unassigned task: the model the orchestrator would want if a new agent were made for it. Not used to create anything. */
  model?: string;
  /** Titles of sibling tasks in the same proposed plan this one needs the output of (e.g. a review task depending on what it reviews). Resolved to Goal.dependsOnGoalIds at materialization. */
  dependsOn?: string[];
}

/**
 * A brain-dump-to-deliverables pipeline: a raw idea, refined by an
 * orchestrator Agent into a brief + task list, which the user reviews and
 * turns into real Goals (see ProposedTask). Status only tracks the
 * refine/plan lifecycle — task completion is derived live from the
 * resulting Goals/Runs rather than duplicated here, for the same
 * single-source-of-truth reason `Goal.agentIds` isn't mirrored onto Agent.
 */
export interface Project {
  id: string;
  rawIdea: string;
  orchestratorAgentId: string;
  status: ProjectStatus;
  title?: string;
  refinedBrief?: string;
  assumptions?: string[];
  proposedTasks?: ProposedTask[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
