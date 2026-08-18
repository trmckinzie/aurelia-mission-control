import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { classifyOllamaModels } from "@/lib/providers/ollama";

describe("classifyOllamaModels", () => {
  test("no models pulled → degraded", () => {
    const result = classifyOllamaModels([]);
    assert.equal(result.status, "degraded");
  });

  test("models pulled but no Hermes model → degraded", () => {
    const result = classifyOllamaModels(["llama3.1:latest", "mistral:latest"]);
    assert.equal(result.status, "degraded");
  });

  test("a Hermes model is pulled → ready", () => {
    const result = classifyOllamaModels(["llama3.1:latest", "hermes3:8b"]);
    assert.equal(result.status, "ready");
    assert.match(result.detail, /hermes3:8b/);
  });

  test("Hermes match is case-insensitive", () => {
    const result = classifyOllamaModels(["Hermes-3-Llama-3.1-8B:latest"]);
    assert.equal(result.status, "ready");
  });
});
