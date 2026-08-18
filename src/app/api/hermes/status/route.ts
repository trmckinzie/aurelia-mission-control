import { NextResponse, type NextRequest } from "next/server";
import { isLocalhostRequest } from "@/lib/http-guard";
import type { HermesStatusResult } from "@/lib/types";

const OLLAMA_URL = "http://127.0.0.1:11434/api/tags";
const TIMEOUT_MS = 1500;

/**
 * Passive local health probe — checks whether Ollama is reachable and
 * whether a Hermes model has been pulled. Does not call any model or
 * perform inference; this is telemetry, not orchestration, so it stays
 * inside "prep phase."
 */
export async function GET(request: NextRequest) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(OLLAMA_URL, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(buildResult("unreachable", []));
    }

    const data = (await res.json()) as { models?: { name?: string; model?: string }[] };
    const models = Array.isArray(data.models)
      ? data.models.map((m) => m.name ?? m.model ?? "").filter((name) => name.length > 0)
      : [];
    const hermesModels = models.filter((m) => /hermes/i.test(m));

    return NextResponse.json(
      buildResult(hermesModels.length > 0 ? "ready" : "reachable-no-hermes", models, hermesModels)
    );
  } catch {
    clearTimeout(timeout);
    return NextResponse.json(buildResult("unreachable", []));
  }
}

function buildResult(
  status: HermesStatusResult["status"],
  models: string[],
  hermesModels: string[] = []
): HermesStatusResult {
  return {
    status,
    ollamaUrl: OLLAMA_URL,
    models,
    hermesModels,
    checkedAt: new Date().toISOString(),
  };
}
