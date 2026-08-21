import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { mutateCollection, readCollection } from "@/lib/store";
import { isValidId, jsonError, parseJsonBody, withLocalGuard } from "@/lib/api-helpers";
import { buildRunPrompt, dispatchAgent, resolveUpstream } from "@/lib/runs";
import { isDispatchable } from "@/lib/status";
import type { Agent, AgentStatus, Goal, GoalStatus, Project, Run } from "@/lib/types";

const COLLECTION = "runs";

export const GET = withLocalGuard(async () => {
  const runs = await readCollection<Run>(COLLECTION);
  runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ runs });
});

/**
 * Dispatches a real agent against a real goal — through Ollama or the Claude
 * Code CLI, based on the agent's model prefix — and streams the response
 * back as plain text as it's generated. The run record is written once
 * immediately (status "running") and once more when the stream ends (status
 * "complete"/"error") — not on every token, to avoid hammering the JSON
 * store during generation.
 */
export const POST = withLocalGuard(async (request) => {
  const body = await parseJsonBody(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const { agentId, goalId } = body;
  if (!isValidId(agentId)) return jsonError("agentId is required", 400);
  if (!isValidId(goalId)) return jsonError("goalId is required", 400);

  const [agents, goals, runs, projects] = await Promise.all([
    readCollection<Agent>("agents"),
    readCollection<Goal>("goals"),
    readCollection<Run>(COLLECTION),
    readCollection<Project>("projects"),
  ]);
  const agent = agents.find((a) => a.id === agentId);
  const goal = goals.find((g) => g.id === goalId);
  if (!agent) return jsonError("Agent not found", 404);
  if (!goal) return jsonError("Goal not found", 404);
  if (!isDispatchable(agent)) {
    return jsonError(`"${agent.name}" is paused — resume it on the Agents page to dispatch to it.`, 409);
  }

  const upstream = resolveUpstream(goal, goals, runs);

  // A goal materialized from a Fleet project carries only its own task
  // instruction — the actual source data/context lives in the project's
  // refined brief, so it has to be looked up and passed in explicitly.
  const projectBrief = goal.projectId ? projects.find((p) => p.id === goal.projectId)?.refinedBrief : undefined;

  const { system, user } = buildRunPrompt(agent, goal, upstream, projectBrief);
  const runId = randomUUID();
  const now = new Date().toISOString();

  const initialRun: Run = {
    id: runId,
    agentId: agent.id,
    agentName: agent.name,
    goalId: goal.id,
    goalTitle: goal.title,
    model: agent.model,
    status: "running",
    prompt: user,
    response: "",
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await mutateCollection<Run>(COLLECTION, (runs) => [...runs, initialRun]);

  /**
   * Goal and agent status used to be write-only fields nothing ever
   * advanced — a goal whose every task had finished still read "Not
   * Started" on the Goals page. Dispatch now moves both, so the stored
   * value reflects reality; a user can still override either afterward.
   */
  async function setLifecycleStatus(goalStatus: GoalStatus, agentStatus: AgentStatus) {
    const updatedAt = new Date().toISOString();
    await Promise.all([
      mutateCollection<Goal>("goals", (goals) =>
        goals.map((g) => (g.id === goal!.id ? { ...g, status: goalStatus, updatedAt } : g))
      ),
      mutateCollection<Agent>("agents", (agents) =>
        // Never clobber a pause set mid-run — that's a deliberate user action.
        agents.map((a) => (a.id === agent!.id && a.status !== "paused" ? { ...a, status: agentStatus, updatedAt } : a))
      ),
    ]);
  }

  await setLifecycleStatus("in-progress", "active");

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of dispatchAgent(agent, system, user)) {
          fullResponse += delta;
          controller.enqueue(encoder.encode(delta));
        }
        await mutateCollection<Run>(COLLECTION, (runs) =>
          runs.map((r) =>
            r.id === runId ? { ...r, status: "complete", response: fullResponse, updatedAt: new Date().toISOString() } : r
          )
        );
        await setLifecycleStatus("done", "idle");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await mutateCollection<Run>(COLLECTION, (runs) =>
          runs.map((r) =>
            r.id === runId
              ? { ...r, status: "error", response: fullResponse, error: message, updatedAt: new Date().toISOString() }
              : r
          )
        );
        await setLifecycleStatus("blocked", "error");
        controller.enqueue(encoder.encode(`\n\n[error: ${message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Run-Id": runId,
    },
  });
});
