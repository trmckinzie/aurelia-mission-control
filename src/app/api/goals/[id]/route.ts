import { NextResponse } from "next/server";
import { mutateCollection } from "@/lib/store";
import { isValidId, jsonError, parseJsonBody, withLocalGuard } from "@/lib/api-helpers";
import type { Goal, GoalPriority, GoalStatus } from "@/lib/types";

const COLLECTION = "goals";
const VALID_STATUSES: GoalStatus[] = ["not-started", "in-progress", "blocked", "done"];
const VALID_PRIORITIES: GoalPriority[] = ["low", "medium", "high"];

export const PATCH = withLocalGuard<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params;
  if (!isValidId(id)) {
    return jsonError("Invalid goal id", 400);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const { status, priority, agentIds } = body;
  const patch: Partial<Pick<Goal, "status" | "priority" | "agentIds">> = {};

  if (status !== undefined) {
    if (typeof status !== "string" || !VALID_STATUSES.includes(status as GoalStatus)) {
      return jsonError(`status must be one of ${VALID_STATUSES.join(", ")}`, 400);
    }
    patch.status = status as GoalStatus;
  }

  if (priority !== undefined) {
    if (typeof priority !== "string" || !VALID_PRIORITIES.includes(priority as GoalPriority)) {
      return jsonError(`priority must be one of ${VALID_PRIORITIES.join(", ")}`, 400);
    }
    patch.priority = priority as GoalPriority;
  }

  if (agentIds !== undefined) {
    if (!Array.isArray(agentIds) || !agentIds.every(isValidId)) {
      return jsonError("agentIds must be an array of valid agent ids", 400);
    }
    patch.agentIds = agentIds;
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("Provide at least one of: status, priority, agentIds", 400);
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
    return jsonError("Goal not found", 404);
  }

  return NextResponse.json({ goal: updated });
});
