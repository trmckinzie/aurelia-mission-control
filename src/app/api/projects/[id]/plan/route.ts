import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { mutateCollection, readCollection } from "@/lib/store";
import { isValidId, jsonError, parseJsonBody, withLocalGuard } from "@/lib/api-helpers";
import type { Agent, Goal, Project, ProposedTask } from "@/lib/types";

const COLLECTION = "projects";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parseTasks(value: unknown): ProposedTask[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const tasks: ProposedTask[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { title, description, assignee, dependsOn } = item as Record<string, unknown>;
    if (!isNonEmptyString(title) || !isNonEmptyString(description)) return null;
    tasks.push({
      title: title.trim(),
      description: description.trim(),
      assignee: isNonEmptyString(assignee) ? assignee.trim() : null,
      dependsOn: Array.isArray(dependsOn) ? dependsOn.filter(isNonEmptyString).map((d) => d.trim()) : [],
    });
  }
  return tasks;
}

/**
 * Materializes the (possibly user-edited) proposed task list into real
 * Goals — the point where the plan stops being a draft and becomes the same
 * Goal data every other page already knows how to dispatch, archive, and
 * delete.
 *
 * Assigns each task to an *existing* Agent by name and creates none. An
 * earlier version minted a fresh agent per task from the task's own
 * title/description, which made every agent an exact clone of its goal and
 * filled the registry with single-use, task-named entries — the opposite of
 * what an agent is for (a reusable specialist, kept across projects). A task
 * whose assignee doesn't match any current agent simply materializes
 * unassigned, for the user to fill in from the org chart or the Goals page.
 *
 * Two passes: create every Goal first, then resolve each task's
 * `dependsOn` (sibling task titles) into `dependsOnGoalIds` — goal ids
 * don't exist until the first pass is done, so a task can't reference a
 * sibling's id before that sibling has one. A title with no match among
 * the just-created goals (renamed/removed before materializing) is
 * dropped rather than treated as an error.
 */
export const POST = withLocalGuard<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params;
  if (!isValidId(id)) return jsonError("Invalid project id", 400);

  const body = await parseJsonBody(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const tasks = parseTasks(body.tasks);
  if (!tasks) return jsonError("tasks must be a non-empty array of {title, description}", 400);

  const [projects, agents] = await Promise.all([
    readCollection<Project>(COLLECTION),
    readCollection<Agent>("agents"),
  ]);
  const project = projects.find((p) => p.id === id);
  if (!project) return jsonError("Project not found", 404);

  const agentIdByName = new Map(agents.map((a) => [a.name, a.id]));
  const now = new Date().toISOString();

  const createdGoals: Goal[] = tasks.map((task) => {
    const agentId = task.assignee ? agentIdByName.get(task.assignee) : undefined;
    return {
      id: randomUUID(),
      title: task.title,
      description: task.description,
      domain: "content",
      status: "not-started",
      priority: "medium",
      agentIds: agentId ? [agentId] : [],
      projectId: id,
      createdAt: now,
      updatedAt: now,
    };
  });

  const goalIdByTitle = new Map(createdGoals.map((g) => [g.title, g.id]));
  tasks.forEach((task, i) => {
    const dependsOnGoalIds = (task.dependsOn ?? [])
      .map((title) => goalIdByTitle.get(title))
      .filter((depId): depId is string => Boolean(depId));
    if (dependsOnGoalIds.length > 0) createdGoals[i].dependsOnGoalIds = dependsOnGoalIds;
  });

  await mutateCollection<Goal>("goals", (goals) => [...goals, ...createdGoals]);

  await mutateCollection<Project>(COLLECTION, (projects) =>
    projects.map((p) => (p.id === id ? { ...p, status: "planned", updatedAt: new Date().toISOString() } : p))
  );

  return NextResponse.json({ goals: createdGoals }, { status: 201 });
});
