import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildRunPrompt, resolveUpstream } from "@/lib/runs";
import type { Agent, Goal, Run } from "@/lib/types";

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

  test("no project brief block when none is provided", () => {
    const { user } = buildRunPrompt(agent, goal);
    assert.doesNotMatch(user, /Project brief/);
  });

  test("injects the project brief when provided, so a project-derived task actually has its source data", () => {
    const { user } = buildRunPrompt(agent, goal, [], "Net take-home pay: $3,200. Essentials: $1,920 (60%).");
    assert.match(user, /Project brief/);
    assert.match(user, /\$3,200/);
  });

  test("ignores a blank project brief", () => {
    const { user } = buildRunPrompt(agent, goal, [], "   ");
    assert.doesNotMatch(user, /Project brief/);
  });
});

function makeRun(overrides: Partial<Run>): Run {
  return {
    id: "r",
    agentId: "a1",
    agentName: "Agent",
    goalId: "dep",
    goalTitle: "Dep Goal",
    model: "ollama/hermes3:8b",
    status: "complete",
    prompt: "",
    response: "output",
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveUpstream", () => {
  const depGoal: Goal = { ...goal, id: "dep", title: "Dependency Goal" };
  const dependent: Goal = { ...goal, id: "g2", dependsOnGoalIds: ["dep"] };

  test("returns nothing when the dependency has no complete run", () => {
    assert.deepEqual(resolveUpstream(dependent, [depGoal], []), []);
  });

  test("returns the dependency's output when it has one complete run", () => {
    const run = makeRun({ response: "the real output" });
    const result = resolveUpstream(dependent, [depGoal], [run]);
    assert.deepEqual(result, [{ title: "Dependency Goal", output: "the real output" }]);
  });

  test("picks the most recent complete run, not the first one in array order", () => {
    const stale = makeRun({ response: "stale output", createdAt: "2026-01-01T00:00:00.000Z" });
    const fresh = makeRun({ response: "fresh output", createdAt: "2026-01-02T00:00:00.000Z" });
    // array order deliberately puts the newer run first to prove sorting, not array position, decides
    const result = resolveUpstream(dependent, [depGoal], [fresh, stale]);
    assert.deepEqual(result, [{ title: "Dependency Goal", output: "fresh output" }]);

    const resultReversed = resolveUpstream(dependent, [depGoal], [stale, fresh]);
    assert.deepEqual(resultReversed, [{ title: "Dependency Goal", output: "fresh output" }]);
  });

  test("ignores a non-complete run even if it's the only one", () => {
    const run = makeRun({ status: "error" });
    assert.deepEqual(resolveUpstream(dependent, [depGoal], [run]), []);
  });

  test("returns an empty array when the goal has no dependencies", () => {
    assert.deepEqual(resolveUpstream(goal, [depGoal], [makeRun({})]), []);
  });
});
