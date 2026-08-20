import type { ProviderCheck, ProviderStatus } from "@/lib/providers/types";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const TIMEOUT_MS = 1500;

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || DEFAULT_BASE_URL;
}

/** Pure classification logic — no I/O — so it's testable without mocking fetch. */
export function classifyOllamaModels(models: string[]): { status: ProviderStatus; detail: string } {
  if (models.length === 0) {
    return { status: "degraded", detail: "Ollama reachable, no models pulled" };
  }
  const hermesModels = models.filter((m) => /hermes/i.test(m));
  if (hermesModels.length > 0) {
    return { status: "ready", detail: `Hermes model available: ${hermesModels[0]}` };
  }
  return { status: "degraded", detail: `No Hermes model pulled (have: ${models.slice(0, 3).join(", ")})` };
}

type TagsResult = { reachable: true; models: string[] } | { reachable: false };

async function fetchOllamaTags(baseUrl: string): Promise<TagsResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return { reachable: false };
    const data = (await res.json()) as { models?: { name?: string; model?: string }[] };
    const models = Array.isArray(data.models)
      ? data.models.map((m) => m.name ?? m.model ?? "").filter((name) => name.length > 0)
      : [];
    return { reachable: true, models };
  } catch {
    return { reachable: false };
  } finally {
    clearTimeout(timeout);
  }
}

/** Agent.model is a free-text label like "ollama/hermes3:8b" — strip the prefix to get the Ollama tag. */
export function resolveOllamaModelTag(model: string): string {
  return model.replace(/^ollama\//, "").trim();
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Streams text deltas from a real Ollama chat completion (this performs
 * inference, unlike everything else in this file). Throws if the request
 * can't be started or Ollama reports an error; partial output already
 * yielded before a mid-stream failure is the caller's to keep or discard.
 */
export async function* streamOllamaChat(model: string, messages: ChatMessage[]): AsyncGenerator<string> {
  const baseUrl = getOllamaBaseUrl();
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: resolveOllamaModelTag(model), messages, stream: true }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama chat request failed (${res.status}): ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let obj: { message?: { content?: string }; error?: string };
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (obj.error) throw new Error(obj.error);
      if (obj.message?.content) yield obj.message.content;
    }
  }
}

/**
 * Covers both "the Hermes agent" and "local AI models" generally — Ollama is
 * the runner for both on this machine. Passive reachability probe only; does
 * not perform inference.
 */
export const ollamaProvider: ProviderCheck = {
  id: "ollama",
  label: "Ollama (Hermes / local models)",
  async check() {
    const baseUrl = getOllamaBaseUrl();
    const result = await fetchOllamaTags(baseUrl);
    if (!result.reachable) {
      return { status: "unreachable" as ProviderStatus, detail: `Ollama not detected at ${baseUrl}` };
    }
    const { status, detail } = classifyOllamaModels(result.models);
    return { status, detail, models: result.models.map((m) => `ollama/${m}`) };
  },
};
