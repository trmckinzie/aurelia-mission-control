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
    const { title, description, model, dependsOn } = item as Record<string, unknown>;
    if (!isNonEmptyString(title) || !isNonEmptyString(description) || !isNonEmptyString(model)) return null;
    tasks.push({
      title: title.trim(),
      description: description.trim(),
      model: model.trim(),
      dependsOn: Array.isArray(dependsOn) ? dependsOn.filter(isNonEmptyString).map((d) => d.trim()) : [],
    });
  }
  return tasks;
}

/**
 * Materializes the (possibly user-edited) proposed task list into real
 * Agents and Goals — the point where the plan stops being a draft and
 * becomes the same Agent/Goal data every other page already knows how to
 * dispatch, archive, and delete. Reuses an existing agent only on an exact
 * match of *both* model and role — matching on model alone (an earlier
 * version of this route did) let a "Quality Control" agent's role bleed
 * into an unrelated "write a draft" task just because both happened to
 * suggest the same model tag, confirmed live: the dispatched agent's own
 * response flagged the role/goal mismatch it had been handed. Role is set
 * from the task description, so in practice a fresh agent gets created per
 * distinct task — correctness over deduplication, since agents are cheap
 * to create and the Agent Registry already supports rename/delete cleanup.
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
  if (!tasks) return jsonError("tasks must be a non-empty array of {title, description, model}", 400);

  const projects = await readCollection<Project>(COLLECTION);
  const project = projects.find((p) => p.id === id);
  if (!project) return jsonError("Project not found", 404);

  const createdGoals: Goal[] = [];

  for (const task of tasks) {
    let agent: Agent | undefined;
    await mutateCollection<Agent>("agents", (agents) => {
      agent = agents.find((a) => a.model === task.model && a.role === task.description);
      if (agent) return agents;
      const now = new Date().toISOString();
      agent = {
        id: randomUUID(),
        name: task.title,
        role: task.description,
        model: task.model,
        status: "idle",
        createdAt: now,
        updatedAt: now,
      };
      return [...agents, agent];
    });

    const now = new Date().toISOString();
    const goal: Goal = {
      id: randomUUID(),
      title: task.title,
      description: task.description,
      domain: "content",
      status: "not-started",
      priority: "medium",
      agentIds: agent ? [agent.id] : [],
      projectId: id,
      createdAt: now,
      updatedAt: now,
    };
    await mutateCollection<Goal>("goals", (goals) => [...goals, goal]);
    createdGoals.push(goal);
  }

  const goalIdByTitle = new Map(createdGoals.map((g) => [g.title, g.id]));
  const dependsOnByGoalId = new Map(
    tasks.map((task, i) => [
      createdGoals[i].id,
      (task.dependsOn ?? []).map((title) => goalIdByTitle.get(title)).filter((depId): depId is string => Boolean(depId)),
    ])
  );
  if ([...dependsOnByGoalId.values()].some((deps) => deps.length > 0)) {
    await mutateCollection<Goal>("goals", (goals) =>
      goals.map((g) => {
        const dependsOnGoalIds = dependsOnByGoalId.get(g.id);
        return dependsOnGoalIds && dependsOnGoalIds.length > 0
          ? { ...g, dependsOnGoalIds, updatedAt: new Date().toISOString() }
          : g;
      })
    );
    createdGoals.forEach((g) => {
      const dependsOnGoalIds = dependsOnByGoalId.get(g.id);
      if (dependsOnGoalIds && dependsOnGoalIds.length > 0) g.dependsOnGoalIds = dependsOnGoalIds;
    });
  }

  await mutateCollection<Project>(COLLECTION, (projects) =>
    projects.map((p) => (p.id === id ? { ...p, status: "planned", updatedAt: new Date().toISOString() } : p))
  );

  return NextResponse.json({ goals: createdGoals }, { status: 201 });
});
