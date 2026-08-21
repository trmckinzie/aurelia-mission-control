import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_STATUS,
  GOAL_STATUS,
  PROJECT_STATUS,
  RUN_STATUS,
  deriveAgentStatus,
  deriveGoalStatus,
  isDispatchable,
} from "@/lib/status";
import type { Run } from "@/lib/types";

function makeRun(overrides: Partial<Run>): Run {
  return {
    id: "r",
    agentId: "a1",
    agentName: "Agent",
    goalId: "g1",
    goalTitle: "Goal",
    model: "ollama/hermes3:8b",
    status: "complete",
    prompt: "",
    response: "",
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("status display maps", () => {
  test("every status has a human label, never the raw enum value", () => {
    assert.equal(GOAL_STATUS["not-started"].label, "Not Started");
    assert.equal(GOAL_STATUS["in-progress"].label, "In Progress");
    assert.equal(AGENT_STATUS.active.label, "Active");
    assert.equal(RUN_STATUS.complete.label, "Complete");
    assert.equal(PROJECT_STATUS.planned.label, "Planned");
  });

  test("every entry carries a className so a badge is never unstyled", () => {
    for (const map of [GOAL_STATUS, AGENT_STATUS, RUN_STATUS, PROJECT_STATUS]) {
      for (const entry of Object.values(map)) {
        assert.ok(entry.className.length > 0, `missing className for ${entry.label}`);
      }
    }
  });
});

describe("deriveGoalStatus", () => {
  const goal = { id: "g1", status: "not-started" as const };

  test("falls back to the stored status when the goal has no runs", () => {
    assert.equal(deriveGoalStatus(goal, []), "not-started");
  });

  test("reports in-progress while a run is in flight", () => {
    assert.equal(deriveGoalStatus(goal, [makeRun({ status: "running" })]), "in-progress");
  });

  test("reports done once the latest run completed — the stale-status bug", () => {
    assert.equal(deriveGoalStatus(goal, [makeRun({ status: "complete" })]), "done");
  });

  test("reports blocked when the latest run errored", () => {
    assert.equal(deriveGoalStatus(goal, [makeRun({ status: "error" })]), "blocked");
  });

  test("uses the latest run, not the first in array order", () => {
    const older = makeRun({ status: "error", createdAt: "2026-01-01T00:00:00.000Z" });
    const newer = makeRun({ status: "complete", createdAt: "2026-01-02T00:00:00.000Z" });
    assert.equal(deriveGoalStatus(goal, [older, newer]), "done");
    assert.equal(deriveGoalStatus(goal, [newer, older]), "done");
  });

  test("a running run wins over an older completed one", () => {
    const done = makeRun({ status: "complete", createdAt: "2026-01-01T00:00:00.000Z" });
    const running = makeRun({ status: "running", createdAt: "2026-01-02T00:00:00.000Z" });
    assert.equal(deriveGoalStatus(goal, [done, running]), "in-progress");
  });

  test("respects a manual blocked flag over a completed run", () => {
    const blocked = { id: "g1", status: "blocked" as const };
    assert.equal(deriveGoalStatus(blocked, [makeRun({ status: "complete" })]), "blocked");
  });

  test("ignores runs belonging to other goals", () => {
    assert.equal(deriveGoalStatus(goal, [makeRun({ goalId: "other", status: "complete" })]), "not-started");
  });
});

describe("deriveAgentStatus", () => {
  const agent = { id: "a1", status: "idle" as const };

  test("reports active while the agent has a run in flight", () => {
    assert.equal(deriveAgentStatus(agent, [makeRun({ status: "running" })]), "active");
  });

  test("falls back to the stored status when nothing is running", () => {
    assert.equal(deriveAgentStatus(agent, [makeRun({ status: "complete" })]), "idle");
  });

  test("paused always wins — a paused agent is never shown as active", () => {
    const paused = { id: "a1", status: "paused" as const };
    assert.equal(deriveAgentStatus(paused, [makeRun({ status: "running" })]), "paused");
  });

  test("ignores runs belonging to other agents", () => {
    assert.equal(deriveAgentStatus(agent, [makeRun({ agentId: "other", status: "running" })]), "idle");
  });
});

describe("isDispatchable", () => {
  test("paused agents are not dispatchable", () => {
    assert.equal(isDispatchable({ status: "paused" }), false);
  });

  test("every other status is dispatchable", () => {
    for (const status of ["defined", "idle", "active", "error"] as const) {
      assert.equal(isDispatchable({ status }), true, `${status} should be dispatchable`);
    }
  });
});
