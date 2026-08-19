import { NextResponse } from "next/server";
import { mutateCollection } from "@/lib/store";
import { isValidId, jsonError, parseJsonBody, withLocalGuard } from "@/lib/api-helpers";
import type { Agent, AgentStatus, Goal } from "@/lib/types";

const COLLECTION = "agents";
const VALID_STATUSES: AgentStatus[] = ["defined", "idle", "active", "paused", "error"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export const PATCH = withLocalGuard<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params;
  if (!isValidId(id)) {
    return jsonError("Invalid agent id", 400);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const { status, name, role, model } = body;
  const patch: Partial<Pick<Agent, "status" | "name" | "role" | "model">> = {};

  if (status !== undefined) {
    if (typeof status !== "string" || !VALID_STATUSES.includes(status as AgentStatus)) {
      return jsonError(`status must be one of ${VALID_STATUSES.join(", ")}`, 400);
    }
    patch.status = status as AgentStatus;
  }

  if (name !== undefined) {
    if (!isNonEmptyString(name)) return jsonError("name must be a non-empty string", 400);
    patch.name = name.trim();
  }

  if (role !== undefined) {
    if (!isNonEmptyString(role)) return jsonError("role must be a non-empty string", 400);
    patch.role = role.trim();
  }

  if (model !== undefined) {
    if (!isNonEmptyString(model)) return jsonError("model must be a non-empty string", 400);
    patch.model = model.trim();
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("Provide at least one of: status, name, role, model", 400);
  }

  let updated: Agent | undefined;
  await mutateCollection<Agent>(COLLECTION, (agents) => {
    const index = agents.findIndex((a) => a.id === id);
    if (index === -1) return agents;
    updated = { ...agents[index], ...patch, updatedAt: new Date().toISOString() };
    const next = [...agents];
    next[index] = updated;
    return next;
  });

  if (!updated) {
    return jsonError("Agent not found", 404);
  }

  return NextResponse.json({ agent: updated });
});

export const DELETE = withLocalGuard<{ params: Promise<{ id: string }> }>(async (_request, { params }) => {
  const { id } = await params;
  if (!isValidId(id)) {
    return jsonError("Invalid agent id", 400);
  }

  let found = false;
  await mutateCollection<Agent>(COLLECTION, (agents) => {
    const next = agents.filter((a) => a.id !== id);
    found = next.length !== agents.length;
    return next;
  });

  if (!found) {
    return jsonError("Agent not found", 404);
  }

  // A deleted agent shouldn't leave a dangling id on any goal's assignment list.
  await mutateCollection<Goal>("goals", (goals) =>
    goals.map((g) =>
      g.agentIds.includes(id)
        ? { ...g, agentIds: g.agentIds.filter((a) => a !== id), updatedAt: new Date().toISOString() }
        : g
    )
  );

  return new NextResponse(null, { status: 204 });
});
