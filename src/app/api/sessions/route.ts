import { NextResponse, type NextRequest } from "next/server";
import { listSessions } from "@/lib/claude-sessions";
import { isLocalhostRequest } from "@/lib/http-guard";

export async function GET(request: NextRequest) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessions = await listSessions();
  return NextResponse.json({ sessions });
}
