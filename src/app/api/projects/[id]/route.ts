import { NextResponse } from "next/server";
import { mutateCollection, readCollection } from "@/lib/store";
import { isValidId, jsonError, withLocalGuard } from "@/lib/api-helpers";
import type { Goal, Project } from "@/lib/types";

const COLLECTION = "projects";

export const GET = withLocalGuard<{ params: Promise<{ id: string }> }>(async (_request, { params }) => {
  const { id } = await params;
  if (!isValidId(id)) return jsonError("Invalid project id", 400);

  const projects = await readCollection<Project>(COLLECTION);
  const project = projects.find((p) => p.id === id);
  if (!project) return jsonError("Project not found", 404);

  return NextResponse.json({ project });
});

export const DELETE = withLocalGuard<{ params: Promise<{ id: string }> }>(async (_request, { params }) => {
  const { id } = await params;
  if (!isValidId(id)) return jsonError("Invalid project id", 400);

  let found = false;
  await mutateCollection<Project>(COLLECTION, (projects) => {
    const next = projects.filter((p) => p.id !== id);
    found = next.length !== projects.length;
    return next;
  });

  if (!found) return jsonError("Project not found", 404);

  // Tasks materialized from this project are just Goals — clean them up too,
  // the same way deleting an agent strips it from every goal's agentIds.
  // Runs stay standing; they already snapshot goalTitle/agentName for exactly
  // this reason (see Run's doc comment in src/lib/types.ts).
  await mutateCollection<Goal>("goals", (goals) => goals.filter((g) => g.projectId !== id));

  return new NextResponse(null, { status: 204 });
});
