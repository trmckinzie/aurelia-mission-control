import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionId, readEventsSince } from "@/lib/claude-sessions";
import { jsonError, withLocalGuard } from "@/lib/api-helpers";

export const GET = withLocalGuard<{ params: Promise<{ id: string }> }>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  if (!isValidSessionId(id)) {
    return jsonError("Invalid session id", 400);
  }

  const offsetParam = request.nextUrl.searchParams.get("offset");
  const offset = offsetParam === null ? undefined : Number(offsetParam);
  if (offset !== undefined && (!Number.isFinite(offset) || offset < 0)) {
    return jsonError("Invalid offset", 400);
  }

  try {
    const result = await readEventsSince(id, offset);
    return NextResponse.json(result);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return jsonError("Session not found", 404);
    }
    throw err;
  }
});
