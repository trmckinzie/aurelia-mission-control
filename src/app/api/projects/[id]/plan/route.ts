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
    const { title, description, model } = item as Record<string, unknown>;
    if (!isNonEmptyString(title) || !isNonEmptyString(description) || !isNonEmptyString(model)) return null;
    tasks.push({ title: title.trim(), description: description.trim(), model: model.trim() });
  }
  return tasks;
}

/**
 * Materializes the (possibly user-edited) proposed task list into real
 * Agents and Goals — the point where the plan stops being a draft and
 * becomes the same Agent/Goal data every other page already knows how to
 * dispatch, archive, and delete. Reuses an existing agent on an exact
 * model match rather than creating a near-duplicate every time.
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
      agent = agents.find((a) => a.model === task.model);
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

  await mutateCollection<Project>(COLLECTION, (projects) =>
    projects.map((p) => (p.id === id ? { ...p, status: "planned", updatedAt: new Date().toISOString() } : p))
  );

  return NextResponse.json({ goals: createdGoals }, { status: 201 });
});
