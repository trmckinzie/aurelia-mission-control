import { NextResponse, type NextRequest } from "next/server";
import { isLocalhostRequest } from "@/lib/http-guard";

type Handler<Ctx> = (request: NextRequest, ctx: Ctx) => Promise<Response> | Response;

/**
 * Wraps a route handler so every request is rejected — before any handler
 * logic runs — unless it came in on a loopback origin. Every route in this
 * app is meant to be local-only; wrap with this rather than re-checking
 * isLocalhostRequest by hand so a new route can't accidentally skip it.
 */
export function withLocalGuard<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, ctx) => {
    if (!isLocalhostRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(request, ctx);
  };
}

/** Parses a JSON object body, returning null (never throwing) on invalid/non-object JSON. */
export async function parseJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

const ID_PATTERN = /^[a-zA-Z0-9-]{1,128}$/;

/** Validates an id (from a URL param or a request body) before it touches the filesystem or store. */
export function isValidId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}
