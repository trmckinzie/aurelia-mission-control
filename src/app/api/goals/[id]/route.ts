import { NextResponse, type NextRequest } from "next/server";
import { mutateCollection } from "@/lib/store";
import { isLocalhostRequest } from "@/lib/http-guard";
import type { Goal, GoalPriority, GoalStatus } from "@/lib/types";

const COLLECTION = "goals";
const VALID_STATUSES: GoalStatus[] = ["not-started", "in-progress", "blocked", "done"];
const VALID_PRIORITIES: GoalPriority[] = ["low", "medium", "high"];
const ID_PATTERN = /^[a-zA-Z0-9-]{1,128}$/;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid goal id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status, priority, agentIds } = (body ?? {}) as Record<string, unknown>;

  const patch: Partial<Pick<Goal, "status" | "priority" | "agentIds">> = {};

  if (status !== undefined) {
    if (typeof status !== "string" || !VALID_STATUSES.includes(status as GoalStatus)) {
      return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }
    patch.status = status as GoalStatus;
  }

  if (priority !== undefined) {
    if (typeof priority !== "string" || !VALID_PRIORITIES.includes(priority as GoalPriority)) {
      return NextResponse.json({ error: `priority must be one of ${VALID_PRIORITIES.join(", ")}` }, { status: 400 });
    }
    patch.priority = priority as GoalPriority;
  }

  if (agentIds !== undefined) {
    if (!Array.isArray(agentIds) || !agentIds.every((a) => typeof a === "string" && ID_PATTERN.test(a))) {
      return NextResponse.json({ error: "agentIds must be an array of valid agent ids" }, { status: 400 });
    }
    patch.agentIds = agentIds;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Provide at least one of: status, priority, agentIds" }, { status: 400 });
  }

  let updated: Goal | undefined;
  await mutateCollection<Goal>(COLLECTION, (goals) => {
    const index = goals.findIndex((g) => g.id === id);
    if (index === -1) return goals;
    updated = { ...goals[index], ...patch, updatedAt: new Date().toISOString() };
    const next = [...goals];
    next[index] = updated;
    return next;
  });

  if (!updated) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  return NextResponse.json({ goal: updated });
}
