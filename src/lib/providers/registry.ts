import { claudeCodeProvider } from "@/lib/providers/claude-code";
import { ollamaProvider } from "@/lib/providers/ollama";
import type { ProviderCheck, ProviderStatusResult } from "@/lib/providers/types";

// Add a new backend by writing a ProviderCheck (see ollama.ts / claude-code.ts
// for the shape) and listing it here — nothing else needs to change.
const PROVIDERS: ProviderCheck[] = [ollamaProvider, claudeCodeProvider];

export async function checkAllProviders(): Promise<ProviderStatusResult[]> {
  return Promise.all(
    PROVIDERS.map(async (provider) => {
      const { status, detail, models } = await provider.check();
      return {
        id: provider.id,
        label: provider.label,
        status,
        detail,
        models,
        checkedAt: new Date().toISOString(),
      };
    })
  );
}
