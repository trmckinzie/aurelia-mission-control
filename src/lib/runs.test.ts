import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildRunPrompt } from "@/lib/runs";
import type { Agent, Goal } from "@/lib/types";

const agent: Agent = {
  id: "a1",
  name: "Circadian Coach",
  role: "Designs personalized circadian rhythm and energy regulation protocols",
  model: "ollama/hermes3:8b",
  status: "idle",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const goal: Goal = {
  id: "g1",
  title: "Optimize circadian rhythm for energy and nervous system regulation",
  description: "Build a personal protocol for light exposure, sleep, and caffeine timing.",
  domain: "productivity",
  status: "not-started",
  priority: "medium",
  agentIds: ["a1"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("buildRunPrompt", () => {
  test("system prompt includes the agent's name and role", () => {
    const { system } = buildRunPrompt(agent, goal);
    assert.match(system, /Circadian Coach/);
    assert.match(system, /Designs personalized circadian rhythm/);
  });

  test("user prompt includes the goal's title, description, domain, and priority", () => {
    const { user } = buildRunPrompt(agent, goal);
    assert.match(user, /Optimize circadian rhythm/);
    assert.match(user, /light exposure, sleep, and caffeine timing/);
    assert.match(user, /productivity/);
    assert.match(user, /medium/);
  });

  test("falls back to a placeholder when the goal has no description", () => {
    const { user } = buildRunPrompt(agent, { ...goal, description: "" });
    assert.match(user, /no additional description provided/);
  });

  test("does not throw on an empty role", () => {
    assert.doesNotThrow(() => buildRunPrompt({ ...agent, role: "" }, goal));
  });

  test("no upstream context block when there's no upstream", () => {
    const { user } = buildRunPrompt(agent, goal);
    assert.doesNotMatch(user, /Context from prior tasks/);
  });

  test("injects upstream task output when provided", () => {
    const { user } = buildRunPrompt(agent, goal, [
      { title: "Script Writing", output: "Here is the full script text." },
    ]);
    assert.match(user, /Context from prior tasks/);
    assert.match(user, /Script Writing/);
    assert.match(user, /Here is the full script text\./);
  });
});
