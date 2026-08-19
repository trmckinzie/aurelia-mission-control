import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { mutateCollection, readCollection } from "@/lib/store";
import { isValidId, jsonError, parseJsonBody, withLocalGuard } from "@/lib/api-helpers";
import type { Agent, Project } from "@/lib/types";

const COLLECTION = "projects";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export const GET = withLocalGuard(async () => {
  const projects = await readCollection<Project>(COLLECTION);
  projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ projects });
});

export const POST = withLocalGuard(async (request) => {
  const body = await parseJsonBody(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const { rawIdea, orchestratorAgentId } = body;
  if (!isNonEmptyString(rawIdea)) return jsonError("rawIdea is a required string", 400);
  if (!isValidId(orchestratorAgentId)) return jsonError("orchestratorAgentId is required", 400);

  const agents = await readCollection<Agent>("agents");
  if (!agents.some((a) => a.id === orchestratorAgentId)) {
    return jsonError("orchestratorAgentId does not match an existing agent", 400);
  }

  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    rawIdea: rawIdea.trim(),
    orchestratorAgentId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  await mutateCollection<Project>(COLLECTION, (projects) => [...projects, project]);

  return NextResponse.json({ project }, { status: 201 });
});
