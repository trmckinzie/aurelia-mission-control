import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildRefinePrompt, parseRefinedPlan } from "@/lib/projects";

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
});

const VALID_PLAN_JSON = JSON.stringify({
  title: "Circadian Rhythm Explainer",
  brief: "# Hook\n...",
  assumptions: ["Assuming a general audience, not athletes specifically."],
  tasks: [
    { title: "Write hook + title options", description: "3 title/hook pairs", model: "claude-code/sonnet" },
    { title: "Draft YouTube description", description: "SEO-friendly description + tags", model: "ollama/llama3.1" },
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
    const missingTitle = JSON.stringify({ brief: "x", tasks: [{ title: "a", description: "b", model: "ollama/x" }] });
    assert.equal(parseRefinedPlan(missingTitle), null);
  });

  test("drops individual malformed tasks instead of failing the whole parse", () => {
    const withBadTask = JSON.stringify({
      title: "T",
      brief: "B",
      tasks: [
        { title: "Good task", description: "desc", model: "ollama/x" },
        { title: "Missing model" },
      ],
    });
    const plan = parseRefinedPlan(withBadTask);
    assert.ok(plan);
    assert.equal(plan?.tasks.length, 1);
    assert.equal(plan?.tasks[0].title, "Good task");
  });

  test("returns null when no tasks survive filtering", () => {
    const noUsableTasks = JSON.stringify({ title: "T", brief: "B", tasks: [{ title: "only a title" }] });
    assert.equal(parseRefinedPlan(noUsableTasks), null);
  });

  test("defaults assumptions to an empty array when omitted", () => {
    const noAssumptions = JSON.stringify({
      title: "T",
      brief: "B",
      tasks: [{ title: "a", description: "b", model: "ollama/x" }],
    });
    const plan = parseRefinedPlan(noAssumptions);
    assert.deepEqual(plan?.assumptions, []);
  });
});
