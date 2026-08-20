export type ProviderId = "ollama" | "claude-code";

/**
 * unknown     — not checked yet (initial client state only; never returned by a check)
 * unreachable — can't connect / binary not found
 * degraded    — reachable, but not fully ready (e.g. Ollama up but no Hermes model pulled)
 * ready       — fully available
 */
export type ProviderStatus = "unknown" | "unreachable" | "degraded" | "ready";

export interface ProviderStatusResult {
  id: ProviderId;
  label: string;
  status: ProviderStatus;
  /** Short human-readable detail, e.g. "No Hermes model pulled" or "v2.1.229". */
  detail: string;
  checkedAt: string;
}

export interface ProviderCheck {
  id: ProviderId;
  label: string;
  check(): Promise<Pick<ProviderStatusResult, "status" | "detail">>;
}

export const CLAUDE_CODE_MODEL_PREFIX = "claude-code/";

/** Agent.model is a free-text label like "ollama/hermes3" or "claude-code/sonnet" — this is the one place that maps it to a provider id. */
export function providerIdForModel(model: string): ProviderId {
  return model.startsWith(CLAUDE_CODE_MODEL_PREFIX) ? "claude-code" : "ollama";
}

/** Pure — no I/O — so callers just pass in whatever /api/providers already returned. */
export function agentProviderStatus(
  model: string,
  providers: Pick<ProviderStatusResult, "id" | "status">[]
): ProviderStatus {
  const id = providerIdForModel(model);
  return providers.find((p) => p.id === id)?.status ?? "unknown";
}
