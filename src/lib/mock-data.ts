export interface LogEvent {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "trace";
  source: string;
  message: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  trace?: string[];
}

export interface SubAgent {
  id: string;
  name: string;
  status: "idle" | "running" | "error";
}

export const SUB_AGENTS: SubAgent[] = [
  { id: "ollama-router", name: "Ollama Router", status: "idle" },
  { id: "content-ingester", name: "Content Ingester", status: "running" },
  { id: "script-drafter", name: "Script Drafter", status: "idle" },
];

export const INITIAL_LOG_EVENTS: LogEvent[] = [
  { id: "l1", timestamp: "18:42:01", level: "info", source: "gateway", message: "hermes gateway run — dispatcher online" },
  { id: "l2", timestamp: "18:42:01", level: "info", source: "dashboard", message: "listening on 0.0.0.0:9119 (auth: basic)" },
  { id: "l3", timestamp: "18:42:03", level: "info", source: "ollama-router", message: "model llama3.1 warm, 12.0 GiB VRAM available" },
  { id: "l4", timestamp: "18:42:04", level: "trace", source: "content-ingester", message: "watching workspace/research/ for new briefs" },
];

const LOG_POOL: Omit<LogEvent, "id" | "timestamp">[] = [
  { level: "info", source: "script-drafter", message: "received research brief (4.2kb), queued for drafting" },
  { level: "trace", source: "ollama-router", message: "routing completion → llama3.1 (local, $0.00)" },
  { level: "info", source: "content-ingester", message: "arXiv scan complete: 8 hits, 2 relevant" },
  { level: "warn", source: "gateway", message: "claude-sonnet-5 fallback skipped — Ollama handled request" },
  { level: "trace", source: "script-drafter", message: "citation check: 6/6 claims traced to References" },
  { level: "info", source: "dashboard", message: "session token refreshed" },
  { level: "trace", source: "ollama-router", message: "context window: 4096 tokens, 812 used" },
];

export function nextMockLogEvent(): LogEvent {
  const pick = LOG_POOL[Math.floor(Math.random() * LOG_POOL.length)];
  const now = new Date();
  const timestamp = now.toLocaleTimeString("en-US", { hour12: false });
  return { id: `l-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`, timestamp, ...pick };
}

export const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "Draft a short script on the testing effect and spaced retrieval.",
    timestamp: "18:41:52",
  },
  {
    id: "m2",
    role: "agent",
    content:
      "Pulled 6 sources (arXiv + PubMed) on retrieval practice and spaced review, routed drafting to the local model — no API spend. Draft is up in the context canvas on the right.\n\n" +
      "Here's the citation-check snippet the drafter ran before returning:\n\n" +
      "```python\n" +
      "def check_citations(script: str, references: list[str]) -> list[str]:\n" +
      "    missing = [c for c in extract_claim_markers(script) if c not in references]\n" +
      "    return missing  # empty == every claim traced to a source\n" +
      "```",
    timestamp: "18:42:10",
    trace: [
      "search_topic_derived: 'testing effect spaced retrieval'",
      "gather_sources → arxiv:3 pubmed:2 web:1",
      "route: script-drafter (ollama/llama3.1)",
      "citation_check: 6/6 claims matched",
      "write workspace/scripts/testing-effect.md (4.1kb)",
    ],
  },
];

export const CONTEXT_CANVAS_MARKDOWN = `# The Testing Effect: Why Quizzing Yourself Beats Rereading

## Hook (0:00-0:15)

Rereading your notes feels productive. It isn't — and the data on why is
almost forty years old.

## Module 1: Retrieval Practice (0:15-2:00)

**Narration:** Every time you force yourself to recall something before
checking the answer, you're doing something rereading never does: making
the memory trace do work [1].

**Cognitive Science Breakdown:** This is the *testing effect* — retrieval
strengthens a memory trace more than passive review, even when no feedback
is given [1][2].

**Actionable Protocol:**
1. Close the notes before you review them.
2. Write down everything you remember first.
3. Only then check what you missed.

## References

1. Roediger & Karpicke — The Power of Testing Memory — https://doi.org/10.1111/j.1745-6916.2006.00012.x
2. Karpicke & Blunt — Retrieval Practice Produces More Learning — https://doi.org/10.1126/science.1191465
`;

export const TOKEN_BUDGET = {
  spentUsd: 4.32,
  limitUsd: 25.0,
  cachedReadRatio: 0.71,
};

export const PING_MS = 3;
