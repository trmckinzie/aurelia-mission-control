import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { mutateCollection, readCollection } from "@/lib/store";
import { jsonError, parseJsonBody, withLocalGuard } from "@/lib/api-helpers";
import type { Goal, GoalDomain, GoalPriority } from "@/lib/types";

const COLLECTION = "goals";
const VALID_DOMAINS: GoalDomain[] = ["productivity", "business-process", "content"];
const VALID_PRIORITIES: GoalPriority[] = ["low", "medium", "high"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export const GET = withLocalGuard(async () => {
  const goals = await readCollection<Goal>(COLLECTION);
  return NextResponse.json({ goals });
});

export const POST = withLocalGuard(async (request) => {
  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const { title, description, domain, priority } = body;

  if (!isNonEmptyString(title)) {
    return jsonError("title is a required string", 400);
  }
  if (typeof domain !== "string" || !VALID_DOMAINS.includes(domain as GoalDomain)) {
    return jsonError(`domain must be one of ${VALID_DOMAINS.join(", ")}`, 400);
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
});
