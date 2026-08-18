import { NextResponse, type NextRequest } from "next/server";
import { mutateCollection } from "@/lib/store";
import { isLocalhostRequest } from "@/lib/http-guard";
import type { Agent, AgentStatus } from "@/lib/types";

const COLLECTION = "agents";
const VALID_STATUSES: AgentStatus[] = ["defined", "idle", "active", "paused", "error"];
const ID_PATTERN = /^[a-zA-Z0-9-]{1,128}$/;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status } = (body ?? {}) as Record<string, unknown>;
  if (typeof status !== "string" || !VALID_STATUSES.includes(status as AgentStatus)) {
    return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
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
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ agent: updated });
}
