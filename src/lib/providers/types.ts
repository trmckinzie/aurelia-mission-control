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
