"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Agent, AgentStatus } from "@/lib/types";

const STATUS_STYLE: Record<AgentStatus, string> = {
  defined: "border-[var(--border)] text-muted-foreground",
  idle: "border-[var(--border)] text-muted-foreground",
  active: "border-[var(--hud-positive)] text-[var(--hud-positive)]",
  paused: "border-[var(--hud-warning)] text-[var(--hud-warning)]",
  error: "border-[var(--hud-critical)] text-[var(--hud-critical)]",
};

const TOGGLEABLE_STATUSES: AgentStatus[] = ["idle", "active", "paused"];

const EDIT_INPUT_CLASS =
  "border border-[var(--border)] bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-[var(--primary)]";

export function AgentRegistry() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [model, setModel] = useState("ollama/hermes3");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editModel, setEditModel] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      if (!res.ok) throw new Error("request failed");
      const data: { agents: Agent[] } = await res.json();
      setAgents(data.agents);
    } catch {
      setError("Could not load agents.");
    }
  }

  useEffect(() => {
    async function initialLoad() {
      await load();
    }
    initialLoad();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role.trim() || !model.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, model }),
      });
      if (!res.ok) throw new Error("request failed");
      setName("");
      setRole("");
      await load();
    } catch {
      setError("Could not create agent.");
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(id: string, status: AgentStatus) {
    setError(null);
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("request failed");
      await load();
    } catch {
      setError("Could not update agent.");
    }
  }

  function startEdit(agent: Agent) {
    setEditingId(agent.id);
    setEditName(agent.name);
    setEditRole(agent.role);
    setEditModel(agent.model);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editName.trim() || !editRole.trim() || !editModel.trim()) return;

    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, role: editRole, model: editModel }),
      });
      if (!res.ok) throw new Error("request failed");
      setEditingId(null);
      await load();
    } catch {
      setError("Could not save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteAgent(agent: Agent) {
    const confirmed = window.confirm(`Permanently delete "${agent.name}"? This can't be undone.`);
    if (!confirmed) return;

    setError(null);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error("request failed");
      await load();
    } catch {
      setError("Could not delete agent.");
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-lg font-semibold text-foreground mb-1">Agent Registry</h1>
        <p className="text-sm text-muted-foreground">
          Define an agent here, assign it to a goal, then dispatch it from the Runs page — both{" "}
          <code className="font-mono">ollama/&lt;model&gt;</code> (Ollama) and{" "}
          <code className="font-mono">claude-code/&lt;model&gt;</code> (Claude Code CLI) agents actually run.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 border border-[var(--border)] bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Content Strategist)"
            className={EDIT_INPUT_CLASS}
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role (e.g. drafts weekly content plan)"
            className={EDIT_INPUT_CLASS}
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model (e.g. ollama/hermes3 or claude-code/sonnet)"
            className={`${EDIT_INPUT_CLASS} font-mono`}
          />
        </div>
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add Agent"}
          </Button>
        </div>
      </form>

      {error && <p className="text-sm text-[var(--hud-critical)]">{error}</p>}

      {agents === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agents defined yet — add one above.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {agents.map((agent) => {
            const isEditing = editingId === agent.id;
            return (
              <div key={agent.id} className="border border-[var(--border)] bg-card px-4 py-3">
                {isEditing ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className={EDIT_INPUT_CLASS} />
                      <input value={editRole} onChange={(e) => setEditRole(e.target.value)} className={EDIT_INPUT_CLASS} />
                      <input
                        value={editModel}
                        onChange={(e) => setEditModel(e.target.value)}
                        className={`${EDIT_INPUT_CLASS} font-mono`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" disabled={savingEdit} onClick={() => saveEdit(agent.id)}>
                        {savingEdit ? "Saving…" : "Save"}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={savingEdit} onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{agent.name}</span>
                        <Badge variant="outline" className={STATUS_STYLE[agent.status]}>
                          {agent.status}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{agent.role}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">{agent.model}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {TOGGLEABLE_STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(agent.id, s)}
                          disabled={agent.status === s}
                          className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-wide ${
                            agent.status === s
                              ? "border-[var(--primary)] text-[var(--primary)]"
                              : "border-[var(--border)] text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                      <span className="mx-1 h-4 w-px bg-[var(--border)]" />
                      <button
                        type="button"
                        onClick={() => startEdit(agent)}
                        className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAgent(agent)}
                        className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-[var(--hud-critical)]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
