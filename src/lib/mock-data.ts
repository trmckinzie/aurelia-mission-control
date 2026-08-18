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
