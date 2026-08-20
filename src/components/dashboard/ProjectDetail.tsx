"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";
import { agentProviderStatus, providerIdForModel } from "@/lib/providers/types";
import type { ProviderStatus, ProviderStatusResult } from "@/lib/providers/types";
import type { Agent, Goal, Project, ProjectStatus, ProposedTask, Run, RunStatus } from "@/lib/types";

const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  draft: "border-[var(--border)] text-muted-foreground",
  refining: "border-[var(--hud-warning)] text-[var(--hud-warning)]",
  refined: "border-[var(--primary)] text-[var(--primary)]",
  planned: "border-[var(--hud-positive)] text-[var(--hud-positive)]",
  error: "border-[var(--hud-critical)] text-[var(--hud-critical)]",
};

const RUN_STATUS_STYLE: Record<RunStatus, string> = {
  running: "border-[var(--hud-positive)] text-[var(--hud-positive)]",
  complete: "border-[var(--primary)] text-[var(--primary)]",
  error: "border-[var(--hud-critical)] text-[var(--hud-critical)]",
};

const TASK_INPUT_CLASS =
  "border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-[var(--primary)]";

const CUSTOM_MODEL_VALUE = "__custom__";

interface TaskCardProps {
  goal: Goal;
  agent: Agent | undefined;
  latestRun: Run | undefined;
  providerStatus: ProviderStatus;
  dependsOnTitles: string[];
  dependenciesReady: boolean;
}

function TaskCard({ goal, agent, latestRun, providerStatus, dependsOnTitles, dependenciesReady }: TaskCardProps) {
  const href = `/runs?goalId=${goal.id}${agent ? `&agentId=${agent.id}` : ""}`;
  const statusLabel = latestRun ? latestRun.status : dependenciesReady ? "not dispatched" : "waiting on deps";
  const statusStyle = latestRun
    ? RUN_STATUS_STYLE[latestRun.status]
    : dependenciesReady
      ? "border-[var(--border)] text-muted-foreground"
      : "border-[var(--hud-warning)] text-[var(--hud-warning)]";

  return (
    <Link
      href={href}
      className="flex w-56 flex-col gap-1.5 border border-[var(--border)] bg-card px-3 py-2.5 hover:border-[var(--primary)]/50"
    >
      <span className="truncate text-sm font-semibold text-foreground">{goal.title}</span>
      <span className="truncate text-xs text-muted-foreground">{agent?.name ?? "Unassigned"}</span>
      {dependsOnTitles.length > 0 && (
        <span className="truncate text-[10px] text-muted-foreground/70">Depends on: {dependsOnTitles.join(", ")}</span>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[10px] text-muted-foreground/70">{agent?.model}</span>
        <Badge variant="outline" className={statusStyle}>
          {statusLabel}
        </Badge>
      </div>
      {providerStatus !== "ready" && providerStatus !== "unknown" && (
        <span className="text-[10px] text-[var(--hud-warning)]">⚠ provider {providerStatus}</span>
      )}
    </Link>
  );
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [providers, setProviders] = useState<ProviderStatusResult[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [refining, setRefining] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [refineError, setRefineError] = useState<string | null>(null);

  const [editableTasks, setEditableTasks] = useState<ProposedTask[]>([]);
  const [customModelRows, setCustomModelRows] = useState<Record<number, boolean>>({});
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [projectRes, agentsRes, goalsRes, runsRes, providersRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
        fetch("/api/agents", { cache: "no-store" }),
        fetch("/api/goals", { cache: "no-store" }),
        fetch("/api/runs", { cache: "no-store" }),
        fetch("/api/providers", { cache: "no-store" }),
      ]);
      if (!projectRes.ok) throw new Error("request failed");
      const projectData: { project: Project } = await projectRes.json();
      const agentsData: { agents: Agent[] } = await agentsRes.json();
      const goalsData: { goals: Goal[] } = await goalsRes.json();
      const runsData: { runs: Run[] } = await runsRes.json();
      setProject(projectData.project);
      setAgents(agentsData.agents);
      setGoals(goalsData.goals);
      setRuns(runsData.runs);
      if (providersRes.ok) {
        const providersData: { providers: ProviderStatusResult[] } = await providersRes.json();
        setProviders(providersData.providers);
      }
      setEditableTasks(projectData.project.proposedTasks ?? []);
      setCustomModelRows({});
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [projectId]);

  useEffect(() => {
    async function initialLoad() {
      await load();
    }
    initialLoad();
  }, [load]);

  async function startRefine() {
    setRefining(true);
    setStreamText("");
    setRefineError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/refine`, { method: "POST" });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Refine failed" }));
        setRefineError(typeof data.error === "string" ? data.error : "Refine failed");
        setRefining(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setStreamText(text);
      }
      setRefining(false);
      await load();
    } catch {
      setRefineError("Connection to the refine stream was lost.");
      setRefining(false);
    }
  }

  function updateTask(index: number, patch: Partial<ProposedTask>) {
    setEditableTasks((prev) => {
      const oldTitle = prev[index].title;
      const next = prev.map((t, i) => (i === index ? { ...t, ...patch } : t));
      if (patch.title !== undefined && patch.title !== oldTitle) {
        return next.map((t) =>
          t.dependsOn?.includes(oldTitle)
            ? { ...t, dependsOn: t.dependsOn.map((d) => (d === oldTitle ? patch.title! : d)) }
            : t
        );
      }
      return next;
    });
  }

  function toggleDependsOn(index: number, siblingTitle: string) {
    setEditableTasks((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const current = t.dependsOn ?? [];
        const next = current.includes(siblingTitle)
          ? current.filter((d) => d !== siblingTitle)
          : [...current, siblingTitle];
        return { ...t, dependsOn: next };
      })
    );
  }

  function removeTask(index: number) {
    setEditableTasks((prev) => {
      const removedTitle = prev[index].title;
      return prev
        .filter((_, i) => i !== index)
        .map((t) => ({ ...t, dependsOn: (t.dependsOn ?? []).filter((d) => d !== removedTitle) }));
    });
  }

  async function materializePlan() {
    if (editableTasks.length === 0) return;
    setPlanning(true);
    setPlanError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: editableTasks }),
      });
      if (!res.ok) throw new Error("request failed");
      await load();
    } catch {
      setPlanError("Could not create agents/goals from this plan.");
    } finally {
      setPlanning(false);
    }
  }

  async function deleteProject() {
    if (!project) return;
    const confirmed = window.confirm(
      `Permanently delete "${project.title || project.rawIdea}"? This also removes any tasks (goals) it created — dispatched runs are kept. This can't be undone.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error("request failed");
      router.push("/fleet");
    } catch {
      setLoadError(true);
    }
  }

  async function copyDeliverables(deliverables: { goal: Goal; run: Run }[]) {
    if (!project) return;
    const parts = [
      `# ${project.title || project.rawIdea}`,
      project.refinedBrief ?? "",
      ...deliverables.map((d) => `## ${d.goal.title}\n\n${d.run.response}`),
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(parts.join("\n\n---\n\n"));
      setCopyError(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

  if (loadError) {
    return <p className="text-sm text-[var(--hud-critical)]">Could not load this project.</p>;
  }
  if (!project) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const orchestrator = agents.find((a) => a.id === project.orchestratorAgentId);
  const orchestratorProviderStatus = orchestrator ? agentProviderStatus(orchestrator.model, providers) : "unknown";
  const orchestratorProviderLabel = orchestrator
    ? (providers.find((p) => p.id === providerIdForModel(orchestrator.model))?.label ?? providerIdForModel(orchestrator.model))
    : "";

  const taskGoals = goals.filter((g) => g.projectId === projectId);
  const latestRunFor = (goalId: string) => runs.find((r) => r.goalId === goalId);
  const completeCount = taskGoals.filter((g) => latestRunFor(g.id)?.status === "complete").length;
  const deliverables = taskGoals
    .map((g) => ({ goal: g, run: latestRunFor(g.id) }))
    .filter((d): d is { goal: Goal; run: Run } => d.run?.status === "complete");

  const knownModels = Array.from(new Set(agents.map((a) => a.model)));
  const claudeReady = providers.find((p) => p.id === "claude-code")?.status === "ready";
  if (claudeReady && !knownModels.some((m) => providerIdForModel(m) === "claude-code")) {
    knownModels.push("claude-code/sonnet");
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-lg font-semibold text-foreground mb-1">
              {project.title || "Untitled brain dump"}
            </h1>
            <Badge variant="outline" className={PROJECT_STATUS_STYLE[project.status]}>
              {project.status}
            </Badge>
          </div>
          <button
            type="button"
            onClick={deleteProject}
            className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-[var(--hud-critical)]"
          >
            Delete Project
          </button>
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Raw idea
          </summary>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{project.rawIdea}</p>
        </details>
      </div>

      {(project.status === "draft" || project.status === "refining") && (
        <div className="border border-[var(--border)] bg-card p-4">
          {project.status === "draft" && (
            <p className="mb-3 text-sm text-muted-foreground">Ready to refine this into a brief and task breakdown.</p>
          )}
          {orchestrator && orchestratorProviderStatus !== "ready" && (
            <p className="mb-3 text-xs text-[var(--hud-warning)]">
              ⚠ {orchestratorProviderLabel} is currently {orchestratorProviderStatus} — refining will likely fail.
              Check AI Providers in the sidebar.
            </p>
          )}
          <Button onClick={startRefine} disabled={refining}>
            {refining ? "Refining…" : orchestrator ? `Refine with ${orchestrator.name}` : "Refine"}
          </Button>
          {refining && (
            <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_85%,black)] px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground/90">
              {streamText}
              <span className="cursor-blink text-[var(--primary)]">▊</span>
            </div>
          )}
          {refineError && <p className="mt-2 text-sm text-[var(--hud-critical)]">{refineError}</p>}
        </div>
      )}

      {(project.status === "refined" || project.status === "error") && (
        <>
          {project.refinedBrief && (
            <div>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Refined Brief
              </h2>
              <div className="border border-[var(--border)] bg-card p-4 text-sm leading-relaxed text-foreground/90">
                <MarkdownContent content={project.refinedBrief} />
              </div>
            </div>
          )}

          {project.assumptions && project.assumptions.length > 0 && (
            <div>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Assumptions to confirm
              </h2>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {project.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {project.status === "error" && (
            <p className="text-sm text-[var(--hud-critical)]">{project.errorMessage}</p>
          )}

          {project.status === "refined" && editableTasks.length > 0 && (
            <div>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Proposed Tasks
              </h2>
              <div className="flex flex-col gap-2">
                {editableTasks.map((task, i) => {
                  const isKnownModel = knownModels.includes(task.model);
                  const showCustom = customModelRows[i] === true || !isKnownModel;
                  const siblingTitles = editableTasks
                    .map((t) => t.title)
                    .filter((t, idx) => idx !== i && t.trim().length > 0);

                  return (
                    <div key={i} className="flex flex-col gap-2 border border-[var(--border)] bg-card p-3">
                      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[2fr_2fr_1fr_auto]">
                        <input
                          value={task.title}
                          onChange={(e) => updateTask(i, { title: e.target.value })}
                          className={TASK_INPUT_CLASS}
                        />
                        <input
                          value={task.description}
                          onChange={(e) => updateTask(i, { description: e.target.value })}
                          className={TASK_INPUT_CLASS}
                        />
                        {showCustom ? (
                          <input
                            value={task.model}
                            onChange={(e) => updateTask(i, { model: e.target.value })}
                            placeholder="e.g. ollama/llama3.1"
                            className={`${TASK_INPUT_CLASS} font-mono`}
                          />
                        ) : (
                          <select
                            value={task.model}
                            onChange={(e) => {
                              if (e.target.value === CUSTOM_MODEL_VALUE) {
                                setCustomModelRows((prev) => ({ ...prev, [i]: true }));
                              } else {
                                updateTask(i, { model: e.target.value });
                              }
                            }}
                            className={`${TASK_INPUT_CLASS} font-mono`}
                          >
                            {knownModels.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                            <option value={CUSTOM_MODEL_VALUE}>Custom…</option>
                          </select>
                        )}
                        <button
                          type="button"
                          onClick={() => removeTask(i)}
                          className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-[var(--hud-critical)]"
                        >
                          Remove
                        </button>
                      </div>

                      {showCustom && !isKnownModel && (
                        <p className="text-[11px] text-[var(--hud-warning)]">
                          ⚠ &quot;{task.model || "(empty)"}&quot; doesn&apos;t match any existing agent or known
                          provider — double-check it&apos;s real before creating an agent from it.
                          {knownModels.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomModelRows((prev) => ({ ...prev, [i]: false }));
                                updateTask(i, { model: knownModels[0] });
                              }}
                              className="ml-2 text-[var(--primary)] hover:underline"
                            >
                              Choose a known model instead
                            </button>
                          )}
                        </p>
                      )}

                      {siblingTitles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                            Depends on:
                          </span>
                          {siblingTitles.map((title) => {
                            const active = (task.dependsOn ?? []).includes(title);
                            return (
                              <button
                                key={title}
                                type="button"
                                onClick={() => toggleDependsOn(i, title)}
                                className={`border px-1.5 py-0.5 font-mono text-[10px] ${
                                  active
                                    ? "border-[var(--primary)] text-[var(--primary)]"
                                    : "border-[var(--border)] text-muted-foreground/70 hover:text-foreground"
                                }`}
                              >
                                {title}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Button onClick={materializePlan} disabled={planning || editableTasks.length === 0}>
                  {planning ? "Creating…" : "Create Agents & Goals"}
                </Button>
                {planError && <p className="text-sm text-[var(--hud-critical)]">{planError}</p>}
              </div>
            </div>
          )}

          <div>
            <Button variant="ghost" onClick={startRefine} disabled={refining}>
              {refining ? "Refining…" : "Refine again"}
            </Button>
          </div>
        </>
      )}

      {project.status === "planned" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="border border-[var(--border)] bg-card px-4 py-2 text-center">
              <span className="text-sm font-semibold text-foreground">{project.title || project.rawIdea}</span>
            </div>
            <div className="h-4 w-px bg-[var(--border)]" />
            <div className="border border-[var(--primary)]/50 bg-card px-4 py-2 text-center">
              <div className="text-sm font-semibold text-foreground">{orchestrator?.name ?? "Orchestrator"}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{orchestrator?.model} · orchestrator</div>
            </div>
            <div className="h-4 w-px bg-[var(--border)]" />
            <div className="w-full border-t border-[var(--border)] pt-4">
              <div className="flex flex-wrap justify-center gap-3">
                {taskGoals.map((goal) => {
                  const agent = agents.find((a) => a.id === goal.agentIds[0]);
                  const dependsOnTitles = (goal.dependsOnGoalIds ?? [])
                    .map((depId) => goals.find((g) => g.id === depId)?.title)
                    .filter((t): t is string => Boolean(t));
                  const dependenciesReady = (goal.dependsOnGoalIds ?? []).every((depId) =>
                    runs.some((r) => r.goalId === depId && r.status === "complete")
                  );
                  return (
                    <TaskCard
                      key={goal.id}
                      goal={goal}
                      agent={agent}
                      latestRun={latestRunFor(goal.id)}
                      providerStatus={agent ? agentProviderStatus(agent.model, providers) : "unknown"}
                      dependsOnTitles={dependsOnTitles}
                      dependenciesReady={dependenciesReady}
                    />
                  );
                })}
              </div>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">
              {completeCount} of {taskGoals.length} tasks complete
            </p>
          </div>

          {deliverables.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Deliverables</h2>
                <div className="flex items-center gap-2">
                  {copyError && (
                    <span className="text-xs text-[var(--hud-critical)]">
                      Clipboard access was denied — select the text below and copy manually.
                    </span>
                  )}
                  <Button size="sm" variant="outline" onClick={() => copyDeliverables(deliverables)}>
                    {copied ? "Copied!" : "Copy deliverables"}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {deliverables.map((d) => (
                  <div key={d.goal.id} className="border border-[var(--border)] bg-card p-4">
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                      {d.goal.title}
                    </div>
                    <div className="text-sm leading-relaxed text-foreground/90">
                      <MarkdownContent content={d.run.response} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
