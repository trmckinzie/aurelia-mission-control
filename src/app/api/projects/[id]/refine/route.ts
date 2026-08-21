import { mutateCollection, readCollection } from "@/lib/store";
import { isValidId, jsonError, withLocalGuard } from "@/lib/api-helpers";
import { dispatchAgent } from "@/lib/runs";
import { buildRefinePrompt, parseRefinedPlan } from "@/lib/projects";
import { isDispatchable } from "@/lib/status";
import type { Agent, Project } from "@/lib/types";

const COLLECTION = "projects";

/**
 * Dispatches the project's orchestrator agent against buildRefinePrompt,
 * streaming the raw response back exactly like POST /api/runs (so the
 * brain-dump UI gets the same live-text feel as Dispatch), then parses the
 * accumulated text into a structured plan once the stream ends. A parse
 * failure doesn't lose the response — it's stored as the brief anyway with
 * status "error", so the user can read it and just retry.
 */
export const POST = withLocalGuard<{ params: Promise<{ id: string }> }>(async (_request, { params }) => {
  const { id } = await params;
  if (!isValidId(id)) return jsonError("Invalid project id", 400);

  const [projects, agents] = await Promise.all([readCollection<Project>(COLLECTION), readCollection<Agent>("agents")]);
  const project = projects.find((p) => p.id === id);
  if (!project) return jsonError("Project not found", 404);

  const orchestrator = agents.find((a) => a.id === project.orchestratorAgentId);
  if (!orchestrator) return jsonError("Orchestrator agent not found — it may have been deleted", 404);

  // The orchestrator assigns work to the other agents, so it sees the roster
  // minus itself and minus anything paused (paused means benched — it
  // shouldn't be handed new work, here or in the dispatch pickers).
  const roster = agents.filter((a) => a.id !== orchestrator.id && isDispatchable(a));
  const { system, user } = buildRefinePrompt(project.rawIdea, roster);

  await mutateCollection<Project>(COLLECTION, (projects) =>
    projects.map((p) => (p.id === id ? { ...p, status: "refining", updatedAt: new Date().toISOString() } : p))
  );

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of dispatchAgent(orchestrator, system, user)) {
          fullResponse += delta;
          controller.enqueue(encoder.encode(delta));
        }

        const parsed = parseRefinedPlan(fullResponse);
        await mutateCollection<Project>(COLLECTION, (projects) =>
          projects.map((p) => {
            if (p.id !== id) return p;
            const updatedAt = new Date().toISOString();
            return parsed
              ? {
                  ...p,
                  status: "refined",
                  title: parsed.title,
                  refinedBrief: parsed.brief,
                  assumptions: parsed.assumptions,
                  proposedTasks: parsed.tasks,
                  errorMessage: undefined,
                  updatedAt,
                }
              : {
                  ...p,
                  status: "error",
                  refinedBrief: fullResponse,
                  assumptions: [],
                  proposedTasks: [],
                  errorMessage: "Could not parse a structured task list from the response — the raw text is saved above.",
                  updatedAt,
                };
          })
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await mutateCollection<Project>(COLLECTION, (projects) =>
          projects.map((p) =>
            p.id === id ? { ...p, status: "error", errorMessage: message, updatedAt: new Date().toISOString() } : p
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
    },
  });
});
