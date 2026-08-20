import type { ProposedTask } from "@/lib/types";

export interface BuiltRefinePrompt {
  system: string;
  user: string;
}

/**
 * Turns a raw brain-dump idea into a prompt instructing the orchestrator
 * agent to respond with a single structured JSON plan — no prose, so
 * parseRefinedPlan can parse it deterministically.
 */
export function buildRefinePrompt(rawIdea: string): BuiltRefinePrompt {
  const system =
    "You are an orchestration planner for a content-creation pipeline. A user gives you a rough, " +
    "possibly underspecified idea. Refine it into a concrete brief and break it into a short list of " +
    "concrete tasks that separate worker agents can each execute independently in one pass.\n\n" +
    "Respond with ONLY a single JSON object — no prose, no markdown code fences, nothing before or " +
    "after it — matching exactly this shape:\n" +
    "{\n" +
    '  "title": string,\n' +
    '  "brief": string (markdown — the refined concept, structure/outline, key points),\n' +
    '  "assumptions": string[] (things you had to infer or guess that the user should confirm or correct),\n' +
    '  "tasks": [\n' +
    "    {\n" +
    '      "title": string,\n' +
    '      "description": string (what this task\'s finished output should be),\n' +
    '      "model": string (a suggested worker, e.g. "ollama/llama3.1" for a straightforward mechanical ' +
    'task, or "claude-code/sonnet" for a task needing sharper judgment or creativity — the user reviews ' +
    "and can change this before anything is created),\n" +
    '      "dependsOn": string[] (optional — exact titles of OTHER tasks in this same list whose output ' +
    "this task needs, e.g. a review/quality-control task should depend on every task producing what it " +
    "reviews, a voiceover task should depend on the task producing the script it reads. Omit or leave " +
    "empty for a task that can run entirely on its own.)\n" +
    "    }\n" +
    "  ]\n" +
    "}\n\n" +
    "Keep the task list short and concrete — usually 3 to 6 tasks.";

  const user = `Idea: ${rawIdea.trim()}`;

  return { system, user };
}

export interface ParsedPlan {
  title: string;
  brief: string;
  assumptions: string[];
  tasks: ProposedTask[];
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : trimmed;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Parses the orchestrator's structured plan response. Tolerant of a
 * ```json fence around the object (models add one despite instructions
 * not to). Drops individual malformed task entries rather than failing
 * the whole parse; returns null only when there's nothing usable at all,
 * so the caller can fall back to storing the raw text instead of losing it.
 */
export function parseRefinedPlan(text: string): ParsedPlan | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;

  if (!isNonEmptyString(record.title) || !isNonEmptyString(record.brief)) return null;

  const assumptions = Array.isArray(record.assumptions) ? record.assumptions.filter(isNonEmptyString) : [];

  const rawTasks = Array.isArray(record.tasks) ? record.tasks : [];
  const tasks: ProposedTask[] = rawTasks
    .filter((t): t is Record<string, unknown> => t !== null && typeof t === "object")
    .map((t) => ({
      title: isNonEmptyString(t.title) ? t.title.trim() : "",
      description: isNonEmptyString(t.description) ? t.description.trim() : "",
      model: isNonEmptyString(t.model) ? t.model.trim() : "",
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.filter(isNonEmptyString).map((d) => d.trim()) : [],
    }))
    .filter((t) => t.title && t.description && t.model);

  if (tasks.length === 0) return null;

  return { title: record.title.trim(), brief: record.brief.trim(), assumptions, tasks };
}
