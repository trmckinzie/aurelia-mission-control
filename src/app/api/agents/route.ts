import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { readCollection, writeCollection } from "@/lib/store";
import { isLocalhostRequest } from "@/lib/http-guard";
import type { Agent } from "@/lib/types";

const COLLECTION = "agents";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function GET(request: NextRequest) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const agents = await readCollection<Agent>(COLLECTION);
  return NextResponse.json({ agents });
}

export async function POST(request: NextRequest) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, role, model } = (body ?? {}) as Record<string, unknown>;
  if (!isNonEmptyString(name) || !isNonEmptyString(role) || !isNonEmptyString(model)) {
    return NextResponse.json({ error: "name, role, and model are required strings" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const agent: Agent = {
    id: randomUUID(),
    name: name.trim(),
    role: role.trim(),
    model: model.trim(),
    status: "defined",
    goalIds: [],
    createdAt: now,
    updatedAt: now,
  };

  const agents = await readCollection<Agent>(COLLECTION);
  agents.push(agent);
  await writeCollection(COLLECTION, agents);

  return NextResponse.json({ agent }, { status: 201 });
}
