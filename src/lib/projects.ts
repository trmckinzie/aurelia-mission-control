import type { Agent, ProposedTask } from "@/lib/types";

export interface BuiltRefinePrompt {
  system: string;
  user: string;
}

/** One line per available specialist, so the orchestrator assigns by real capability instead of guessing. */
function formatRoster(agents: Pick<Agent, "name" | "role" | "model">[]): string {
  return agents.map((a) => `- ${a.name} — ${a.role} (runs on ${a.model})`).join("\n");
}

/**
 * Turns a raw brain-dump idea into a prompt instructing the orchestrator
 * agent to respond with a single structured JSON plan — no prose, so
 * parseRefinedPlan can parse it deterministically.
 *
 * Takes the real agent roster because an earlier version didn't: it named
 * two example models inline and nothing else, so the orchestrator — with no
 * idea what actually existed — tagged nearly every task with the "smart"
 * example (claude-code/sonnet) and once emitted a model tag that wasn't even
 * installed. Assignment is by agent name rather than by model so the plan
 * stays about *who does the work*, and so a task can't invent a worker that
 * doesn't exist.
 */
export function buildRefinePrompt(
  rawIdea: string,
  agents: Pick<Agent, "name" | "role" | "model">[] = []
): BuiltRefinePrompt {
  const hasRoster = agents.length > 0;
  const rosterBlock = hasRoster
    ? "\n\nAvailable specialist agents — assign each task to whichever one genuinely fits its work:\n" +
      formatRoster(agents) +
      "\n\nMatch by specialty, not by prestige: a review or fact-check task goes to a reviewing/QC " +
      "specialist, a coding task to a coding specialist, a calculation to a math specialist, short " +
      "mechanical work (titles, formatting, summaries) to a fast lightweight agent, and long-form " +
      "writing polish to an editor. Do NOT assign every task to the same agent — that wastes the " +
      "roster and is usually the wrong tool for at least half the work. If genuinely no listed agent " +
      'fits a task, set its "assignee" to null and the user will pick one.'
    : "\n\nNo specialist agents are defined yet, so set every task's \"assignee\" to null.";

  const system =
    "You are an orchestration planner for a content-creation pipeline. A user gives you a rough, " +
    "possibly underspecified idea. Refine it into a concrete brief and break it into a short list of " +
    "concrete tasks that separate worker agents can each execute independently in one pass." +
    rosterBlock +
    "\n\nRespond with ONLY a single JSON object — no prose, no markdown code fences, nothing before or " +
    "after it — matching exactly this shape:\n" +
    "{\n" +
    '  "title": string,\n' +
    '  "brief": string (markdown — the refined concept, structure/outline, key points),\n' +
    '  "assumptions": string[] (things you had to infer or guess that the user should confirm or correct),\n' +
    '  "tasks": [\n' +
    "    {\n" +
    '      "title": string (the deliverable, e.g. "Fact-check the draft" — a piece of work, not a job title),\n' +
    '      "description": string (what this task\'s finished output should be),\n' +
    '      "assignee": string | null (the EXACT name of one agent from the roster above, or null if none fit),\n' +
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

  // A task is kept on title + description alone. `assignee` is deliberately
  // not required: an unmatched or null assignee is a valid, expected outcome
  // (the user picks during review), so dropping those tasks would silently
  // discard real work from the plan.
  const rawTasks = Array.isArray(record.tasks) ? record.tasks : [];
  const tasks: ProposedTask[] = rawTasks
    .filter((t): t is Record<string, unknown> => t !== null && typeof t === "object")
    .map((t) => ({
      title: isNonEmptyString(t.title) ? t.title.trim() : "",
      description: isNonEmptyString(t.description) ? t.description.trim() : "",
      assignee: isNonEmptyString(t.assignee) ? t.assignee.trim() : null,
      model: isNonEmptyString(t.model) ? t.model.trim() : undefined,
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.filter(isNonEmptyString).map((d) => d.trim()) : [],
    }))
    .filter((t) => t.title && t.description);

  if (tasks.length === 0) return null;

  return { title: record.title.trim(), brief: record.brief.trim(), assumptions, tasks };
}
