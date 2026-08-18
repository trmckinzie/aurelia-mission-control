import { NextResponse } from "next/server";
import { mutateCollection } from "@/lib/store";
import { jsonError, parseJsonBody, withLocalGuard } from "@/lib/api-helpers";
import type { Agent, AgentStatus } from "@/lib/types";

const COLLECTION = "agents";
const VALID_STATUSES: AgentStatus[] = ["defined", "idle", "active", "paused", "error"];
const ID_PATTERN = /^[a-zA-Z0-9-]{1,128}$/;

export const PATCH = withLocalGuard<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return jsonError("Invalid agent id", 400);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const { status } = body;
  if (typeof status !== "string" || !VALID_STATUSES.includes(status as AgentStatus)) {
    return jsonError(`status must be one of ${VALID_STATUSES.join(", ")}`, 400);
  }

  let updated: Agent | undefined;
  await mutateCollection<Agent>(COLLECTION, (agents) => {
    const index = agents.findIndex((a) => a.id === id);
    if (index === -1) return agents;
    updated = { ...agents[index], status: status as AgentStatus, updatedAt: new Date().toISOString() };
    const next = [...agents];
    next[index] = updated;
    return next;
  });

  if (!updated) {
    return jsonError("Agent not found", 404);
  }

  return NextResponse.json({ agent: updated });
});
