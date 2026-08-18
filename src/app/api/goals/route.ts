import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { mutateCollection, readCollection } from "@/lib/store";
import { isLocalhostRequest } from "@/lib/http-guard";
import type { Goal, GoalDomain, GoalPriority } from "@/lib/types";

const COLLECTION = "goals";
const VALID_DOMAINS: GoalDomain[] = ["productivity", "business-process", "content"];
const VALID_PRIORITIES: GoalPriority[] = ["low", "medium", "high"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function GET(request: NextRequest) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const goals = await readCollection<Goal>(COLLECTION);
  return NextResponse.json({ goals });
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

  const { title, description, domain, priority } = (body ?? {}) as Record<string, unknown>;

  if (!isNonEmptyString(title)) {
    return NextResponse.json({ error: "title is a required string" }, { status: 400 });
  }
  if (typeof domain !== "string" || !VALID_DOMAINS.includes(domain as GoalDomain)) {
    return NextResponse.json({ error: `domain must be one of ${VALID_DOMAINS.join(", ")}` }, { status: 400 });
  }
  const resolvedPriority: GoalPriority =
    typeof priority === "string" && VALID_PRIORITIES.includes(priority as GoalPriority)
      ? (priority as GoalPriority)
      : "medium";

  const now = new Date().toISOString();
  const goal: Goal = {
    id: randomUUID(),
    title: title.trim(),
    description: typeof description === "string" ? description.trim() : "",
    domain: domain as GoalDomain,
    status: "not-started",
    priority: resolvedPriority,
    agentIds: [],
    createdAt: now,
    updatedAt: now,
  };

  await mutateCollection<Goal>(COLLECTION, (goals) => [...goals, goal]);

  return NextResponse.json({ goal }, { status: 201 });
}
