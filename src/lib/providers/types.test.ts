import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { agentProviderStatus, providerIdForModel } from "@/lib/providers/types";

describe("providerIdForModel", () => {
  test("maps a claude-code/ model to the claude-code provider", () => {
    assert.equal(providerIdForModel("claude-code/sonnet"), "claude-code");
  });

  test("maps anything else to ollama", () => {
    assert.equal(providerIdForModel("ollama/hermes3:8b"), "ollama");
    assert.equal(providerIdForModel("claude-script/script3.0"), "ollama");
  });
});

describe("agentProviderStatus", () => {
  const providers = [
    { id: "ollama" as const, status: "ready" as const },
    { id: "claude-code" as const, status: "unreachable" as const },
  ];

  test("looks up the matching provider's status", () => {
    assert.equal(agentProviderStatus("ollama/hermes3:8b", providers), "ready");
    assert.equal(agentProviderStatus("claude-code/sonnet", providers), "unreachable");
  });

  test("returns unknown when the provider isn't in the list", () => {
    assert.equal(agentProviderStatus("claude-code/sonnet", []), "unknown");
  });
});
