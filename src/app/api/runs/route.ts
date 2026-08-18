import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { mutateCollection, readCollection } from "@/lib/store";
import { jsonError, parseJsonBody, withLocalGuard } from "@/lib/api-helpers";
import { streamOllamaChat } from "@/lib/providers/ollama";
import { buildRunPrompt } from "@/lib/runs";
import type { Agent, Goal, Run } from "@/lib/types";

const COLLECTION = "runs";
const ID_PATTERN = /^[a-zA-Z0-9-]{1,128}$/;

export const GET = withLocalGuard(async () => {
  const runs = await readCollection<Run>(COLLECTION);
  runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ runs });
});

/**
 * Dispatches a real agent against a real goal through Ollama and streams the
 * response back as plain text as it's generated. The run record is written
 * once immediately (status "running") and once more when the stream ends
 * (status "complete"/"error") — not on every token, to avoid hammering the
 * JSON store during generation.
 */
export const POST = withLocalGuard(async (request) => {
  const body = await parseJsonBody(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const { agentId, goalId } = body;
  if (typeof agentId !== "string" || !ID_PATTERN.test(agentId)) {
    return jsonError("agentId is required", 400);
  }
  if (typeof goalId !== "string" || !ID_PATTERN.test(goalId)) {
    return jsonError("goalId is required", 400);
  }

  const [agents, goals] = await Promise.all([readCollection<Agent>("agents"), readCollection<Goal>("goals")]);
  const agent = agents.find((a) => a.id === agentId);
  const goal = goals.find((g) => g.id === goalId);
  if (!agent) return jsonError("Agent not found", 404);
  if (!goal) return jsonError("Goal not found", 404);

  const { system, user } = buildRunPrompt(agent, goal);
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
    createdAt: now,
    updatedAt: now,
  };
  await mutateCollection<Run>(COLLECTION, (runs) => [...runs, initialRun]);

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of streamOllamaChat(agent.model, [
          { role: "system", content: system },
          { role: "user", content: user },
        ])) {
          fullResponse += delta;
          controller.enqueue(encoder.encode(delta));
        }
        await mutateCollection<Run>(COLLECTION, (runs) =>
          runs.map((r) =>
            r.id === runId ? { ...r, status: "complete", response: fullResponse, updatedAt: new Date().toISOString() } : r
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await mutateCollection<Run>(COLLECTION, (runs) =>
          runs.map((r) =>
            r.id === runId
              ? { ...r, status: "error", response: fullResponse, error: message, updatedAt: new Date().toISOString() }
              : r
          )
        );
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
