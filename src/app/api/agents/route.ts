import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { mutateCollection, readCollection } from "@/lib/store";
import { jsonError, parseJsonBody, withLocalGuard } from "@/lib/api-helpers";
import type { Agent } from "@/lib/types";

const COLLECTION = "agents";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export const GET = withLocalGuard(async () => {
  const agents = await readCollection<Agent>(COLLECTION);
  return NextResponse.json({ agents });
});

export const POST = withLocalGuard(async (request) => {
  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const { name, role, model } = body;
  if (!isNonEmptyString(name) || !isNonEmptyString(role) || !isNonEmptyString(model)) {
    return jsonError("name, role, and model are required strings", 400);
  }

  const now = new Date().toISOString();
  const agent: Agent = {
    id: randomUUID(),
    name: name.trim(),
    role: role.trim(),
    model: model.trim(),
    status: "defined",
    createdAt: now,
    updatedAt: now,
  };

  await mutateCollection<Agent>(COLLECTION, (agents) => [...agents, agent]);

  return NextResponse.json({ agent }, { status: 201 });
});
