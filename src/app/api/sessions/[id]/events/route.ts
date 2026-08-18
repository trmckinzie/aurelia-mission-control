import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionId, readEventsSince } from "@/lib/claude-sessions";
import { isLocalhostRequest } from "@/lib/http-guard";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!isValidSessionId(id)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const offsetParam = request.nextUrl.searchParams.get("offset");
  const offset = offsetParam === null ? undefined : Number(offsetParam);
  if (offset !== undefined && (!Number.isFinite(offset) || offset < 0)) {
    return NextResponse.json({ error: "Invalid offset" }, { status: 400 });
  }

  try {
    const result = await readEventsSince(id, offset);
    return NextResponse.json(result);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    throw err;
  }
}
