import { NextResponse } from "next/server";
import { mutateCollection } from "@/lib/store";
import { isValidId, jsonError, parseJsonBody, withLocalGuard } from "@/lib/api-helpers";
import type { Run } from "@/lib/types";

const COLLECTION = "runs";

export const PATCH = withLocalGuard<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params;
  if (!isValidId(id)) return jsonError("Invalid run id", 400);

  const body = await parseJsonBody(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const { archived } = body;
  if (typeof archived !== "boolean") {
    return jsonError("archived must be a boolean", 400);
  }

  let updated: Run | undefined;
  await mutateCollection<Run>(COLLECTION, (runs) => {
    const index = runs.findIndex((r) => r.id === id);
    if (index === -1) return runs;
    updated = { ...runs[index], archived, updatedAt: new Date().toISOString() };
    const next = [...runs];
    next[index] = updated;
    return next;
  });

  if (!updated) return jsonError("Run not found", 404);

  return NextResponse.json({ run: updated });
});

export const DELETE = withLocalGuard<{ params: Promise<{ id: string }> }>(async (_request, { params }) => {
  const { id } = await params;
  if (!isValidId(id)) return jsonError("Invalid run id", 400);

  let existed = false;
  await mutateCollection<Run>(COLLECTION, (runs) => {
    const next = runs.filter((r) => r.id !== id);
    existed = next.length !== runs.length;
    return next;
  });

  if (!existed) return jsonError("Run not found", 404);

  return new NextResponse(null, { status: 204 });
});
