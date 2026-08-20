import { CLAUDE_CODE_MODEL_PREFIX, providerIdForModel } from "@/lib/providers/types";
import type { ProviderStatusResult } from "@/lib/providers/types";
import type { Agent } from "@/lib/types";

/**
 * Model aliases the Claude Code CLI accepts via --model — "sonnet" was
 * confirmed working live; a bad alias here now fails loudly (see
 * extractResultError in claude-code.ts) rather than silently, so this list
 * is safe to extend without much ceremony.
 */
export const CLAUDE_CODE_MODEL_ALIASES = ["sonnet", "opus", "haiku"] as const;

export const CLAUDE_CODE_MODEL_VALUES: string[] = CLAUDE_CODE_MODEL_ALIASES.map(
  (alias) => `${CLAUDE_CODE_MODEL_PREFIX}${alias}`
);

export interface ModelOption {
  value: string;
  label: string;
}

export interface ModelOptionGroup {
  label: string;
  options: ModelOption[];
}

/**
 * The full set of model values worth offering in a picker: the curated
 * Claude Code aliases, whatever Ollama tags are actually installed (from a
 * live /api/providers check), and anything already in use by an existing
 * Agent — so a model that's working today never silently disappears from
 * the list just because it isn't in the curated/live sources. This is the
 * fix for the class of bug where a hand-typed model string (e.g. "claude
 * -code/sonnet 5") is accepted, saved, and only fails at dispatch time.
 */
export function modelOptionGroups(
  providers: Pick<ProviderStatusResult, "id" | "models">[],
  agents: Pick<Agent, "model">[] = []
): ModelOptionGroup[] {
  const claudeSet = new Set<string>(CLAUDE_CODE_MODEL_VALUES);
  const ollamaSet = new Set<string>();

  for (const provider of providers) {
    if (!provider.models) continue;
    const target = provider.id === "claude-code" ? claudeSet : ollamaSet;
    provider.models.forEach((m) => target.add(m));
  }

  for (const agent of agents) {
    const model = agent.model?.trim();
    if (!model) continue;
    (providerIdForModel(model) === "claude-code" ? claudeSet : ollamaSet).add(model);
  }

  // Claude Code keeps curated order (sonnet first — the one this app has actually verified end
  // to end) rather than alphabetizing, since that order is itself a deliberate preference ranking.
  const claudeOrdered = [
    ...CLAUDE_CODE_MODEL_VALUES.filter((v) => claudeSet.has(v)),
    ...[...claudeSet].filter((v) => !CLAUDE_CODE_MODEL_VALUES.includes(v)).sort(),
  ];

  const groups: ModelOptionGroup[] = [];
  if (claudeOrdered.length > 0) {
    groups.push({ label: "Claude Code", options: claudeOrdered.map((value) => ({ value, label: value })) });
  }
  if (ollamaSet.size > 0) {
    groups.push({ label: "Ollama", options: [...ollamaSet].sort().map((value) => ({ value, label: value })) });
  }
  return groups;
}

/**
 * The sensible default for a new agent/task: the first option belonging to
 * a provider that's actually ready right now, so a brand-new form doesn't
 * default to a model nobody can currently dispatch to.
 */
export function defaultModelValue(
  groups: ModelOptionGroup[],
  providers: Pick<ProviderStatusResult, "id" | "status">[]
): string {
  for (const group of groups) {
    for (const option of group.options) {
      if (providers.find((p) => p.id === providerIdForModel(option.value))?.status === "ready") {
        return option.value;
      }
    }
  }
  return groups[0]?.options[0]?.value ?? "ollama/hermes3";
}
