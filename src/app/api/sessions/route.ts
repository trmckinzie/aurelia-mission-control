import { NextResponse } from "next/server";
import { listSessions } from "@/lib/claude-sessions";
import { withLocalGuard } from "@/lib/api-helpers";

export const GET = withLocalGuard(async () => {
  const sessions = await listSessions();
  return NextResponse.json({ sessions });
});
