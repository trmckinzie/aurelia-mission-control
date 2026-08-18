# AURELIA Mission Control

A local-first "mission control" dashboard for AI-agent-driven work — personal
productivity/telemetry, business processes, and content creation, run by
agents that are meant to eventually communicate and make decisions toward
your goals. The intended engine behind those agents is **Hermes**, [Nous
Research](https://nousresearch.com)'s agentic model family, run locally
(via [Ollama](https://ollama.com)) — not a fictional placeholder.

## Current state

Real, locally-sourced data is steadily replacing the original mock UI. As of
now:

- **Claude Code Sessions** (left sidebar) and **Session Event Log** (bottom
  left) read this project's actual Claude Code session transcripts —
  Claude Code writes one append-only JSONL file per session under
  `~/.claude/projects/<sanitized-cwd>/`. See
  [`src/lib/claude-sessions.ts`](src/lib/claude-sessions.ts) and the
  `/api/sessions` routes. Read-only, scoped to this project's own sessions
  only (derived from the server's own `process.cwd()`, never a client
  value), gated to loopback requests only.
- **AI Providers** (header dot + sidebar panel) are real, passive
  availability probes — Ollama (`127.0.0.1:11434/api/tags`, covering both
  Hermes and local models generally) and the Claude Code CLI (`claude
  --version`). Neither performs inference; see `/api/providers` and
  [Architecture](#architecture) below for how to add another backend.
- **Agent Registry** (`/agents`) is real local data with read/write API
  routes — define agents (name, role, intended model), see them listed,
  toggle status by hand. Agents don't run anything yet; this is the roster
  Hermes will dispatch to once orchestration is wired up.
- **Goals** (`/goals`) is a three-column board across the app's three domains
  (personal productivity, business process, content creation). Create goals,
  toggle status/priority, and assign agents from the registry — the goal is
  the single source of truth for that relationship (`Goal.agentIds`), not
  mirrored back onto `Agent` to avoid a dual-write bidirectional-relationship
  bug.
- **Runs** (`/runs`) is real execution — the actual orchestration step. Pick
  an agent and a goal, hit Dispatch, and an Ollama-backed agent (`model:
  "ollama/<tag>"`) streams a real chat completion back live, token by token,
  then gets persisted to run history. Not a demo: the first real dispatch —
  a "Circadian Coach" agent against a goal to optimize circadian rhythm for
  energy and nervous-system regulation, run on `hermes3:8b` — produced a
  genuine, useful multi-section protocol in ~7 seconds. See `/api/runs` and
  [Architecture](#architecture).
- Chat stream, token/spend budget, and the context canvas are still mock
  data in [`src/lib/mock-data.ts`](src/lib/mock-data.ts).

Agents, Goals, and Runs all persist to `.aurelia/data/*.json` (gitignored —
local runtime state, not source) via [`src/lib/store.ts`](src/lib/store.ts),
which serializes all reads/writes per collection so concurrent API requests
can't corrupt the file or silently drop an update (`mutateCollection`) —
this was a real bug caught during testing (concurrent PATCHes
truncated/duplicated the JSON), not a hypothetical one.

Not built yet, in rough order: dispatching to the Claude Code CLI as a
second execution path (Runs currently only knows how to call Ollama), a
content pipeline view, and an agent decision/communication log.

## Stack

- **Next.js 16** (App Router, Turbopack) — see `AGENTS.md`, this is a newer
  major version with breaking changes from what most tooling/training data
  assumes; check `node_modules/next/dist/docs/` before making framework-level
  changes.
- **React 19**
- **Tailwind CSS v4** with [shadcn](https://ui.shadcn.com) components built
  on [Base UI](https://base-ui.com) (not Radix)
- `react-markdown` + `remark-gfm` for rendering the chat stream and context
  canvas, `react-syntax-highlighter` for code blocks in chat

## Getting started

```bash
npm install
cp .env.local.example .env.local   # optional — defaults work if you haven't changed ports
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

```bash
npm run lint    # ESLint
npm test        # node:test, via tsx — see Testing below
npm run build   # Production build (also type-checks)
npm run start   # Serve a production build
```

## Architecture

**Providers.** Every AI backend this dashboard can see — Ollama (Hermes /
local models) and the Claude Code CLI today — is a `ProviderCheck` in
[`src/lib/providers/`](src/lib/providers): an `id`, a `label`, and an async
`check()` returning a status (`unreachable` / `degraded` / `ready`) and a
human-readable detail string. `registry.ts` runs every registered check in
parallel behind `GET /api/providers`. To add another backend (another local
model server, a hosted API, whatever comes next), write one file matching
that shape and add it to the `PROVIDERS` array — nothing else needs to
change, including the UI, which already renders whatever the registry
returns. Config is env-var-driven (`OLLAMA_BASE_URL`, `CLAUDE_CODE_BIN` — see
[`.env.local.example`](.env.local.example)), not hardcoded, so it survives
port changes or a differently-named binary without a code edit.

**API routes.** Every route lives under `src/app/api/` and is wrapped in
[`withLocalGuard`](src/lib/api-helpers.ts), which rejects anything that
didn't arrive on a loopback `Host` header before the handler runs — a new
route gets this by construction, not by remembering to copy a check.
`parseJsonBody`/`jsonError` cover the rest of the repeated boilerplate
(body parsing, consistent error shape). Mutating routes (agents, goals) go
through [`mutateCollection`](src/lib/store.ts) rather than reading and
writing a JSON file directly — see Testing below for why that matters.

**Data.** Agents, Goals, and Runs persist to `.aurelia/data/*.json`
(gitignored — local runtime state, not source) via `src/lib/store.ts`,
which serializes all reads/writes per collection so concurrent requests
can't corrupt the file or silently drop an update. This isn't a
hypothetical concern: an earlier version of this store used `Date.now()`
for temp filenames and no serialization, and concurrent PATCHes actually
corrupted `goals.json` during testing. `mutateCollection()` fixes it and
has a regression test.

**Dispatch (Runs).** `POST /api/runs` is the one route that isn't
read/write-only — it performs real inference. Given an `agentId` and
`goalId`, [`buildRunPrompt`](src/lib/runs.ts) (a pure function, unit
tested) turns the agent's role and the goal's title/description/domain/
priority into a system+user prompt; [`streamOllamaChat`](src/lib/providers/ollama.ts)
opens a real streaming chat completion against Ollama and yields text
deltas as an async generator. The route writes a `Run` record immediately
(status `running`), forwards each delta straight through to the HTTP
response as plain text as it arrives — so the browser can render tokens
live instead of waiting for the whole response — and writes the record
once more (status `complete`/`error`, full response) when the stream ends.
Currently Ollama-only; routing to a different provider based on the
agent's `model` prefix (e.g. dispatching a `claude-code/...` agent through
the Claude Code CLI instead) is the natural next extension and shouldn't
require touching the route's shape, just the model-resolution step.

## Testing

```bash
npm test
```

Runs on Node's built-in test runner (`node:test`) via `tsx` for TypeScript
+ path-alias support — no test framework dependency. Test files are
co-located as `*.test.ts` next to what they cover; Node discovers them
recursively on its own, so **don't** pass an explicit glob like
`src/**/*.test.ts` to the test script — plain POSIX `sh`/`bash` (what CI and
`npm` scripts actually run under) doesn't expand `**` recursively without
`globstar`, so a glob argument silently drops tests in nested directories.
Verified this by running the suite in a clean `node:22` Linux container and
watching a nested test file disappear before switching to no-argument
discovery.

Coverage is deliberately aimed at logic that's actually bitten this
project — `store.ts`'s concurrency (10 truly parallel writes, checked for
data loss and corruption), `http-guard.ts`'s Host-header parsing (which had
its own bug: naive `split(":")` breaks on bracketed IPv6 literals like
`[::1]:3000`, caught by writing the test) — plus `runs.ts`'s pure prompt
builder, since it's the one piece of the dispatch path that's practical to
test without a live model.

## Project layout

```
src/
  app/                       App Router entry (layout, error/not-found)
  app/page.tsx               Overview route (chat + context canvas)
  app/agents/                 Agent Registry route
  app/goals/                   Goals board route
  app/runs/                     Dispatch + run history route
  app/api/sessions/           Read-only Claude Code session data (this project only)
  app/api/agents/              Agent Registry CRUD (local JSON, read/write)
  app/api/goals/                Goals CRUD (local JSON, read/write)
  app/api/providers/            Provider status aggregation (see Architecture)
  app/api/runs/                  Dispatch a real agent+goal to a model, streamed
  components/dashboard/      AURELIA-specific panels (nav, telemetry, logs, agents, goals, runs, canvas)
  components/dashboard/MarkdownContent.tsx  Shared markdown+code renderer (chat, run responses)
  components/ui/             shadcn/Base UI primitives
  lib/providers/              Provider abstraction — one file per backend + registry
  lib/claude-sessions.ts     Reads/tails this project's local session transcripts
  lib/runs.ts                 Pure prompt-building for dispatch (unit tested)
  lib/store.ts               Concurrency-safe local JSON-file persistence (.aurelia/data/)
  lib/api-helpers.ts         Shared route wrapper (localhost guard) + body parsing
  lib/http-guard.ts          Loopback-only request check
  lib/types.ts               Agent / Goal / Run domain types
  lib/mock-data.ts           Remaining mock data — swap for real gateway calls later
  lib/utils.ts               `cn()` class-merging helper
  **/*.test.ts               Co-located tests — see Testing above
```

## Security notes

- `next.config.ts` sets baseline security headers (CSP, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) via `headers()`.
  Deliberately **not** set: `Strict-Transport-Security` — this is meant to run
  as a local/LAN tool over plain HTTP, and pinning HSTS on a `localhost`
  origin can lock a browser out of it for months.
- `npm run dev` / `npm run start` bind to `127.0.0.1` explicitly (Next.js
  defaults to `0.0.0.0`, i.e. reachable from anyone on the LAN). Every API
  route is also wrapped in `withLocalGuard` (see Architecture), which checks
  the `Host` header and rejects anything that isn't `localhost`/`127.0.0.1`
  — belt-and-suspenders, since the network binding is the layer that
  actually keeps other machines out; a Host header can in principle be
  forged by a client on the same machine. Both the guard and the IPv6
  Host-header parsing it depends on have test coverage.
- Session/agent/goal ids from the URL are validated against a strict pattern
  before touching the filesystem or the data store, so there's no
  path-traversal surface in any `[id]` route.
- `POST /api/runs` performs real inference and is the most expensive/
  consequential route in the app — same `withLocalGuard` + id-validation
  treatment as everything else, but worth knowing it's there: it's the one
  route where "someone else on this box hits your API" means "someone else
  runs a model on your machine and reads the output," not just reads or
  writes a to-do-list-shaped JSON file.
- Nothing here is authenticated. Fine for single-user localhost; revisit
  before this — especially `/api/runs` — is reachable from anywhere else.
