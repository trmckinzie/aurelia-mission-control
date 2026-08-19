# AURELIA Mission Control

A local-first "mission control" dashboard for AI-agent-driven work — personal
productivity/telemetry, business processes, and content creation, run by
agents that are meant to eventually communicate and make decisions toward
your goals. The intended engine behind those agents is **Hermes**, [Nous
Research](https://nousresearch.com)'s agentic model family, run locally
(via [Ollama](https://ollama.com)) — not a fictional placeholder.

## Current state

Every page shows real, locally-sourced data — there is no mock UI left in
this app. As of now:

- **Overview** (`/`, [`src/components/dashboard/Overview.tsx`](src/components/dashboard/Overview.tsx))
  is a real status dashboard, not a demo: goal/agent counts by status, the
  5 most recent runs with live status badges, and quick links into each
  page — with a first-run "getting started" pointer when there's no data
  yet instead of empty cards.
- **Claude Code Sessions** (left sidebar) and **Session Event Log** (bottom
  left) read this project's actual Claude Code session transcripts —
  Claude Code writes one append-only JSONL file per session under
  `~/.claude/projects/<sanitized-cwd>/`. See
  [`src/lib/claude-sessions.ts`](src/lib/claude-sessions.ts) and the
  `/api/sessions` routes. Read-only, scoped to this project's own sessions
  only (derived from the server's own `process.cwd()`, never a client
  value), gated to loopback requests only. This is this project's own build
  conversations, not a dispatch target — that's the separate "Claude Code
  CLI" entry under AI Providers below, and the sidebar says so explicitly
  since the two easily get confused.
- **AI Providers** (header + sidebar panel) are real, passive availability
  probes — Ollama (`127.0.0.1:11434/api/tags`, covering both Hermes and
  local models generally) and the Claude Code CLI (`claude --version`).
  Neither performs inference; see `/api/providers` and
  [Architecture](#architecture) below for how to add another backend. The
  header shows both providers' status at a glance (not just Ollama), since
  both are real dispatch backends now.
- **Agent Registry** (`/agents`) is real local data with full read/write API
  routes — define agents (name, role, model), rename/re-role/re-model an
  existing one inline, delete one you no longer need, toggle status by
  hand. Both `ollama/<model>` and `claude-code/<model>` agents actually run
  when dispatched. Deleting an agent also strips it from any goal's
  assignment list, so nothing is left pointing at a row that no longer
  exists.
- **Goals** (`/goals`) is a three-column board across the app's three domains
  (personal productivity, business process, content creation). Create,
  delete, toggle status/priority, and assign agents from the registry — the
  goal is the single source of truth for that relationship (`Goal.agentIds`),
  not mirrored back onto `Agent` to avoid a dual-write
  bidirectional-relationship bug. That assignment now actually matters at
  dispatch time — see Runs below.
- **Runs** (`/runs`) is real execution — the actual orchestration step. Pick
  an agent and a goal, hit Dispatch, and the agent streams a real response
  back live, token by token, then gets persisted to run history. When a
  selected goal has assigned agents, the agent picker groups them under
  "Assigned to this goal" ahead of everything else, so the assignment made
  on the Goals page is actually visible here instead of a flat,
  unrelated list. Two dispatch paths exist, picked by the agent's model
  prefix: `ollama/<tag>` goes to Ollama; `claude-code/<model>` shells out to
  the Claude Code CLI headlessly (`claude -p ... --output-format
  stream-json`) with `--tools ""` so it can't take any agentic action — it's
  a plain chat completion, not a coding session against a goal description
  it didn't write. Not a demo: the first real dispatch — a "Circadian Coach"
  agent against a goal to optimize circadian rhythm for energy and
  nervous-system regulation, run on `hermes3:8b` — produced a genuine,
  useful multi-section protocol in ~7 seconds. Run history has
  Active/Archived tabs — archive a run to get it out of the way without
  losing it, or delete one permanently (confirmed via a browser dialog
  first, since it can't be undone). A run also shows up as a live-pulsing
  dot on the Runs nav link while it's in flight, visible from any page. See
  `/api/runs` and [Architecture](#architecture).
- **Fleet** (`/fleet`) is the end-to-end pipeline: blurb a rough idea,
  refine it with an orchestrator agent into a brief + task breakdown,
  review and edit the proposed tasks, materialize them into real
  Agents/Goals, then dispatch each and watch it complete on an org-chart
  view — Project (root) → orchestrator → task nodes, each showing its
  assigned agent and live status, linking straight into Runs to dispatch.
  A "Copy deliverables" button bundles every completed task's output into
  one paste-ready block. **Scope note:** this produces a finished,
  copy-ready deliverable — it does not post anywhere. There's no YouTube
  (or other platform) integration; publishing is something you do
  yourself with the output. See `/api/projects` and
  [Architecture](#architecture).

Agents, Goals, Runs, and Projects all persist to `.aurelia/data/*.json`
(gitignored — local runtime state, not source) via
[`src/lib/store.ts`](src/lib/store.ts), which serializes all reads/writes
per collection so concurrent API requests can't corrupt the file or
silently drop an update (`mutateCollection`) — this was a real bug caught
during testing (concurrent PATCHes truncated/duplicated the JSON), not a
hypothetical one.

Not built yet, in rough order: bulk/parallel task dispatch from Fleet
("dispatch all"), a real diagrammed org chart (today's is a plain CSS
tree, deliberately, to avoid a new dependency), and an agent
decision/communication log.

## Stack

- **Next.js 16** (App Router, Turbopack) — see `AGENTS.md`, this is a newer
  major version with breaking changes from what most tooling/training data
  assumes; check `node_modules/next/dist/docs/` before making framework-level
  changes.
- **React 19**
- **Tailwind CSS v4** with [shadcn](https://ui.shadcn.com) components built
  on [Base UI](https://base-ui.com) (not Radix)
- `react-markdown` + `remark-gfm` for rendering run responses,
  `react-syntax-highlighter` for code blocks within them

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
(body parsing, consistent error shape). Mutating routes (agents, goals,
runs) go through [`mutateCollection`](src/lib/store.ts) rather than reading
and writing a JSON file directly — see Testing below for why that matters.
`agents/[id]` and `goals/[id]` both support `PATCH` (partial update) and
`DELETE` (permanent removal, 204) using the same pattern established by
`runs/[id]`; deleting an agent additionally strips its id from every
goal's `agentIds` in a second `mutateCollection("goals", ...)` call, so
deletion can't leave a dangling reference on a goal it was assigned to.

**Data.** Agents, Goals, Runs, and Projects persist to `.aurelia/data/*.json`
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
priority into a system+user prompt. A small `dispatchAgent` helper in the
route picks the provider by the agent's `model` prefix — nothing else about
the route's shape changes when a new provider is added:
- `ollama/<tag>` → [`streamOllamaChat`](src/lib/providers/ollama.ts) opens
  a real streaming chat completion against Ollama and yields text deltas as
  an async generator.
- `claude-code/<model>` → [`streamClaudeCodeChat`](src/lib/providers/claude-code.ts)
  spawns the `claude` CLI headlessly (`-p`, `--output-format stream-json`,
  `--include-partial-messages`) and parses each `stream_event` line for its
  text delta. It always runs with `--tools ""`, so the CLI has no
  Bash/Edit/Read/etc. available — this is meant to behave like a plain chat
  completion (the same contract `streamOllamaChat` has), not an autonomous
  coding session against a goal description it didn't write. Args go
  through `spawn` as an array (no shell), so goal/agent text can't be
  interpreted as shell syntax. A hard timeout kills the process as a
  defensive backstop; it's not a workaround for a known hang — a
  non-interactive `-p` run with no TTY to prompt silently denies any action
  needing approval rather than blocking on one.

Either way, the route writes a `Run` record immediately (status `running`),
forwards each delta straight through to the HTTP response as plain text as
it arrives — so the browser can render tokens live instead of waiting for
the whole response — and writes the record once more (status
`complete`/`error`, full response) when the stream ends.

**Run organization.** `PATCH /api/runs/[id]` flips a run's `archived` flag;
`DELETE /api/runs/[id]` removes one permanently. Both reuse `mutateCollection`,
so they're subject to the same concurrency guarantees as everything else in
the store. The Active/Archived split happens client-side (`RunHistory`
filters on `run.archived`) rather than as two separate endpoints — one list,
one flag, less to keep in sync. Delete is irreversible, so the UI confirms
via `window.confirm()` before calling it; a plain native dialog was a
deliberate choice over a custom confirmation component for something this
infrequent and this destructive — no new UI surface to get wrong.

**Fleet (brain dump → deliverables).** A `Project`
([`src/lib/types.ts`](src/lib/types.ts)) holds a raw idea, an orchestrator
`Agent` id, and — once refined — a brief, assumptions, and a proposed task
list. The design principle here is maximal reuse: a materialized "task" is
just a normal `Goal` (tagged with `projectId`), so once it exists,
everything downstream — dispatch, streaming, run history, archive/delete —
is code that already exists and is already tested. Nothing new was built
for task execution; Fleet only adds the steps *before* a Goal exists.

- `POST /api/projects/[id]/refine` dispatches the orchestrator agent
  through the exact same `dispatchAgent` helper `/api/runs` uses (moved to
  [`src/lib/runs.ts`](src/lib/runs.ts) so both routes share it), streaming
  the raw response back the same way. [`buildRefinePrompt`](src/lib/projects.ts)
  instructs the model to reply with a single JSON object (title, brief,
  assumptions, tasks); [`parseRefinedPlan`](src/lib/projects.ts) parses it
  — tolerant of a stray ` ```json ` fence, and it drops individually
  malformed tasks rather than failing the whole plan. Real local models
  don't always follow the schema perfectly (in testing, a small model
  invented task "models" like `dall-e/2.0` that don't correspond to any
  real provider) — that's exactly why the next step is a review, not an
  auto-execute.
- `POST /api/projects/[id]/plan` takes the (possibly user-edited) task
  list and materializes it: an exact `Agent.model` match gets reused, a
  new one gets created if not — same rationale as any other agent, so the
  Agent Registry stays real, editable data with no hidden agents. Each
  task becomes a `Goal` with `domain: "content"` and `projectId` set.
- `DELETE /api/projects/[id]` cascade-deletes the Project's own Goals (same
  reasoning as agent-delete's cascade cleanup) but leaves their Runs
  standing — Runs already snapshot `goalTitle`/`agentName` for exactly
  this reason.
- The org chart itself does zero new data-fetching beyond what already
  exists — it composes `GET /api/projects/[id]` with the existing
  `GET /api/goals`/`GET /api/agents`/`GET /api/runs`, filtered client-side
  by `projectId`, matching the scale this is meant to run at.

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
builder and the pure parsing/resolution helpers in each provider
(`classifyOllamaModels`, `resolveClaudeCodeModelTag`, `extractStreamDelta`),
since those are the pieces of the dispatch path that are practical to test
without a live model or a real CLI process. Same idea for Fleet:
`buildRefinePrompt`/`parseRefinedPlan` (`src/lib/projects.ts`) are tested
against well-formed JSON, JSON wrapped in a code fence, non-JSON text, and
a response with one malformed task mixed into otherwise-valid ones — the
last case is what an imperfect real model response actually looks like,
not a hypothetical.

## Project layout

```
src/
  app/                       App Router entry (layout, error/not-found)
  app/page.tsx               Overview route — real status dashboard
  app/agents/                 Agent Registry route
  app/goals/                   Goals board route
  app/runs/                     Dispatch + run history route
  app/fleet/                     Fleet list + "new brain dump" route
  app/fleet/[id]/                  Project detail / org chart route
  app/api/sessions/           Read-only Claude Code session data (this project only)
  app/api/agents/              Agent Registry CRUD (local JSON, read/write)
  app/api/agents/[id]/          Edit (PATCH) or permanently delete (DELETE) an agent
  app/api/goals/                Goals CRUD (local JSON, read/write)
  app/api/goals/[id]/            Edit (PATCH) or permanently delete (DELETE) a goal
  app/api/providers/            Provider status aggregation (see Architecture)
  app/api/runs/                  Dispatch a real agent+goal to a model, streamed
  app/api/runs/[id]/              Archive (PATCH) or permanently delete (DELETE) a run
  app/api/projects/              Fleet Projects CRUD (local JSON, read/write)
  app/api/projects/[id]/          Get (GET) or delete with cascade (DELETE) a project
  app/api/projects/[id]/refine/     Dispatch the orchestrator, stream + parse the plan
  app/api/projects/[id]/plan/        Materialize proposed tasks into Agents + Goals
  components/dashboard/      AURELIA-specific panels (nav, telemetry, logs, agents, goals, runs, fleet)
  components/dashboard/Overview.tsx  Home dashboard — real goal/agent/run summaries
  components/dashboard/FleetList.tsx    Project list + new-brain-dump form
  components/dashboard/ProjectDetail.tsx  Refine/plan review + org chart + deliverables
  components/dashboard/MarkdownContent.tsx  Shared markdown+code renderer (run responses)
  components/ui/             shadcn/Base UI primitives
  lib/providers/              Provider abstraction — one file per backend + registry
  lib/providers/ollama.ts     Ollama health check + streaming chat dispatch
  lib/providers/claude-code.ts  Claude Code CLI health check + streaming dispatch (--tools "")
  lib/claude-sessions.ts     Reads/tails this project's local session transcripts
  lib/runs.ts                 Pure prompt-building + shared dispatch-provider selection (unit tested)
  lib/projects.ts             Pure refine-prompt building + plan parsing (unit tested)
  lib/store.ts               Concurrency-safe local JSON-file persistence (.aurelia/data/)
  lib/api-helpers.ts         Shared route wrapper (localhost guard) + body parsing
  lib/http-guard.ts          Loopback-only request check
  lib/types.ts               Agent / Goal / Run / Project / LogEvent domain types
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
- The Claude Code CLI dispatch path (`streamClaudeCodeChat`) always runs
  with `--tools ""` — the CLI gets no Bash/Edit/Read/Write access at all,
  so a goal description can't cause it to take any action on this machine
  beyond generating text. It's spawned via `spawn(bin, args)` (an argument
  array, not a shell string), so nothing in the goal/agent text can be
  interpreted as shell syntax.
- Fleet's `POST /api/projects/[id]/refine` is just another consumer of the
  same `dispatchAgent` path `POST /api/runs` uses — the orchestrator agent
  gets no more (and no less) access than any other dispatched agent. It
  proposes a plan as text; AURELIA's own backend is what actually creates
  Agents/Goals from it, deterministically, only after `POST
  /api/projects/[id]/plan` is called — the orchestrator itself never gets
  live tool access to create anything.
- `POST /api/runs` performs real inference and is the most expensive/
  consequential route in the app — same `withLocalGuard` + id-validation
  treatment as everything else, but worth knowing it's there: it's the one
  route where "someone else on this box hits your API" means "someone else
  runs a model on your machine and reads the output," not just reads or
  writes a to-do-list-shaped JSON file.
- Nothing here is authenticated. Fine for single-user localhost; revisit
  before this — especially `/api/runs` — is reachable from anywhere else.
