import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildRefinePrompt, parseRefinedPlan } from "@/lib/projects";

const ROSTER = [
  { name: "Quality Reviewer", role: "Fact-checks other agents' output", model: "ollama/deepseek-r1:14b" },
  { name: "Senior Editor", role: "Polishes long-form writing", model: "ollama/qwen2.5:14b" },
];

describe("buildRefinePrompt", () => {
  test("includes the raw idea in the user prompt", () => {
    const { user } = buildRefinePrompt("a 10-minute YouTube video about circadian rhythm");
    assert.match(user, /10-minute YouTube video about circadian rhythm/);
  });

  test("instructs JSON-only output with the expected shape", () => {
    const { system } = buildRefinePrompt("anything");
    assert.match(system, /ONLY a single JSON object/);
    assert.match(system, /"title"/);
    assert.match(system, /"tasks"/);
  });

  test("lists each available agent by name, role, and model so assignment isn't a guess", () => {
    const { system } = buildRefinePrompt("anything", ROSTER);
    assert.match(system, /Quality Reviewer/);
    assert.match(system, /Fact-checks other agents' output/);
    assert.match(system, /ollama\/deepseek-r1:14b/);
    assert.match(system, /Senior Editor/);
  });

  test("tells the orchestrator not to send every task to the same agent", () => {
    const { system } = buildRefinePrompt("anything", ROSTER);
    assert.match(system, /Do NOT assign every task to the same agent/);
  });

  test("asks for assignment by agent name, not by raw model tag", () => {
    const { system } = buildRefinePrompt("anything", ROSTER);
    assert.match(system, /"assignee"/);
    assert.doesNotMatch(system, /"model": string/);
  });

  test("instructs everything unassigned when no agents exist", () => {
    const { system } = buildRefinePrompt("anything", []);
    assert.match(system, /No specialist agents are defined yet/);
  });
});

const VALID_PLAN_JSON = JSON.stringify({
  title: "Circadian Rhythm Explainer",
  brief: "# Hook\n...",
  assumptions: ["Assuming a general audience, not athletes specifically."],
  tasks: [
    { title: "Write hook + title options", description: "3 title/hook pairs", assignee: "Senior Editor" },
    { title: "Draft YouTube description", description: "SEO-friendly description + tags", assignee: null },
  ],
});

describe("parseRefinedPlan", () => {
  test("parses a well-formed plain JSON response", () => {
    const plan = parseRefinedPlan(VALID_PLAN_JSON);
    assert.ok(plan);
    assert.equal(plan?.title, "Circadian Rhythm Explainer");
    assert.equal(plan?.tasks.length, 2);
    assert.equal(plan?.assumptions.length, 1);
  });

  test("parses a response wrapped in a ```json fence", () => {
    const fenced = "```json\n" + VALID_PLAN_JSON + "\n```";
    const plan = parseRefinedPlan(fenced);
    assert.ok(plan);
    assert.equal(plan?.tasks.length, 2);
  });

  test("returns null for non-JSON text", () => {
    assert.equal(parseRefinedPlan("Sure, here's an idea for your video..."), null);
  });

  test("returns null when title or brief is missing", () => {
    const missingTitle = JSON.stringify({ brief: "x", tasks: [{ title: "a", description: "b" }] });
    assert.equal(parseRefinedPlan(missingTitle), null);
  });

  test("drops individual malformed tasks instead of failing the whole parse", () => {
    const withBadTask = JSON.stringify({
      title: "T",
      brief: "B",
      tasks: [
        { title: "Good task", description: "desc", assignee: "Senior Editor" },
        { title: "Missing description" },
      ],
    });
    const plan = parseRefinedPlan(withBadTask);
    assert.ok(plan);
    assert.equal(plan?.tasks.length, 1);
    assert.equal(plan?.tasks[0].title, "Good task");
  });

  test("parses assignee per task", () => {
    const plan = parseRefinedPlan(VALID_PLAN_JSON);
    assert.equal(plan?.tasks[0].assignee, "Senior Editor");
    assert.equal(plan?.tasks[1].assignee, null);
  });

  test("keeps an unassigned task rather than discarding real work", () => {
    const allUnassigned = JSON.stringify({
      title: "T",
      brief: "B",
      tasks: [{ title: "a", description: "b" }],
    });
    const plan = parseRefinedPlan(allUnassigned);
    assert.equal(plan?.tasks.length, 1);
    assert.equal(plan?.tasks[0].assignee, null);
  });

  test("returns null when no tasks survive filtering", () => {
    const noUsableTasks = JSON.stringify({ title: "T", brief: "B", tasks: [{ title: "only a title" }] });
    assert.equal(parseRefinedPlan(noUsableTasks), null);
  });

  test("defaults assumptions to an empty array when omitted", () => {
    const noAssumptions = JSON.stringify({
      title: "T",
      brief: "B",
      tasks: [{ title: "a", description: "b" }],
    });
    const plan = parseRefinedPlan(noAssumptions);
    assert.deepEqual(plan?.assumptions, []);
  });

  test("parses dependsOn per task", () => {
    const withDeps = JSON.stringify({
      title: "T",
      brief: "B",
      tasks: [
        { title: "Script Writing", description: "write it" },
        { title: "Quality Control", description: "review it", dependsOn: ["Script Writing"] },
      ],
    });
    const plan = parseRefinedPlan(withDeps);
    assert.deepEqual(plan?.tasks[0].dependsOn, []);
    assert.deepEqual(plan?.tasks[1].dependsOn, ["Script Writing"]);
  });

  test("defaults dependsOn to an empty array when omitted, and drops non-string entries", () => {
    const messyDeps = JSON.stringify({
      title: "T",
      brief: "B",
      tasks: [
        { title: "a", description: "b" },
        { title: "c", description: "d", dependsOn: ["a", 5, null, "  "] },
      ],
    });
    const plan = parseRefinedPlan(messyDeps);
    assert.deepEqual(plan?.tasks[0].dependsOn, []);
    assert.deepEqual(plan?.tasks[1].dependsOn, ["a"]);
  });
});
