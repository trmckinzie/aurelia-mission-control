import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { CLAUDE_CODE_MODEL_VALUES, defaultModelValue, modelOptionGroups } from "@/lib/providers/catalog";

describe("modelOptionGroups", () => {
  test("always includes the curated Claude Code aliases, even with no providers/agents", () => {
    const groups = modelOptionGroups([], []);
    const claude = groups.find((g) => g.label === "Claude Code");
    assert.ok(claude);
    assert.deepEqual(
      claude.options.map((o) => o.value).sort(),
      [...CLAUDE_CODE_MODEL_VALUES].sort()
    );
  });

  test("has no Ollama group when nothing is installed and no agent uses one", () => {
    const groups = modelOptionGroups([{ id: "claude-code", models: undefined }], []);
    assert.equal(
      groups.find((g) => g.label === "Ollama"),
      undefined
    );
  });

  test("surfaces real installed Ollama tags from a live provider check", () => {
    const groups = modelOptionGroups([{ id: "ollama", models: ["ollama/hermes3:8b", "ollama/llama3.1"] }], []);
    const ollama = groups.find((g) => g.label === "Ollama");
    assert.ok(ollama);
    assert.deepEqual(
      ollama.options.map((o) => o.value).sort(),
      ["ollama/hermes3:8b", "ollama/llama3.1"]
    );
  });

  test("keeps a model already in use by an agent even if it's not curated or installed", () => {
    const groups = modelOptionGroups([], [{ model: "ollama/some-custom-tag" }]);
    const ollama = groups.find((g) => g.label === "Ollama");
    assert.ok(ollama?.options.some((o) => o.value === "ollama/some-custom-tag"));
  });

  test("does not duplicate a value present in both the live check and an agent", () => {
    const groups = modelOptionGroups(
      [{ id: "ollama", models: ["ollama/hermes3:8b"] }],
      [{ model: "ollama/hermes3:8b" }]
    );
    const ollama = groups.find((g) => g.label === "Ollama");
    assert.equal(ollama?.options.filter((o) => o.value === "ollama/hermes3:8b").length, 1);
  });
});

describe("defaultModelValue", () => {
  test("picks the first option belonging to a ready provider", () => {
    const groups = modelOptionGroups([{ id: "ollama", models: ["ollama/hermes3:8b"] }], []);
    const value = defaultModelValue(groups, [
      { id: "claude-code", status: "unreachable" },
      { id: "ollama", status: "ready" },
    ]);
    assert.equal(value, "ollama/hermes3:8b");
  });

  test("falls back to the first option anywhere when nothing is ready", () => {
    const groups = modelOptionGroups([], []);
    const value = defaultModelValue(groups, [{ id: "claude-code", status: "unreachable" }]);
    assert.equal(value, groups[0].options[0].value);
  });

  test("falls back to a static guess when there are no groups at all", () => {
    assert.equal(defaultModelValue([], []), "ollama/hermes3");
  });
});
