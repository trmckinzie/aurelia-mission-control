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
- **Hermes Gateway status** (top-right of the header) is a real, passive
  probe against a local Ollama instance (`127.0.0.1:11434/api/tags`),
  reporting whether Ollama is reachable and whether a Hermes model has been
  pulled. It does not perform inference or orchestration — see
  `/api/hermes/status`.
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
- Chat stream, token/spend budget, and the context canvas are still mock
  data in [`src/lib/mock-data.ts`](src/lib/mock-data.ts).

Agents and Goals both persist to `.aurelia/data/*.json` (gitignored — local
runtime state, not source) via [`src/lib/store.ts`](src/lib/store.ts), which
serializes all reads/writes per collection so concurrent API requests can't
corrupt the file or silently drop an update (`mutateCollection`) — this was a
real bug caught during testing (concurrent PATCHes truncated/duplicated the
JSON), not a hypothetical one.

Not built yet, in rough order: a content pipeline view, an agent
decision/communication log, and — the actual orchestration wiring — a
running Hermes-via-Ollama harness that agents defined in the registry can
actually be dispatched to.

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
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

```bash
npm run lint    # ESLint
npm run build   # Production build (also type-checks)
npm run start   # Serve a production build
```

## Project layout

```
src/
  app/                     App Router entry (layout, error/not-found)
  app/page.tsx             Overview route (chat + context canvas)
  app/agents/               Agent Registry route
  app/goals/                 Goals board route
  app/api/sessions/         Read-only Claude Code session data (this project only)
  app/api/agents/            Agent Registry CRUD (local JSON, read/write)
  app/api/goals/              Goals CRUD (local JSON, read/write)
  app/api/hermes/status/     Real Ollama/Hermes reachability probe
  components/dashboard/    AURELIA-specific panels (nav, telemetry, logs, agents, goals, canvas)
  components/ui/           shadcn/Base UI primitives
  lib/claude-sessions.ts   Reads/tails this project's local session transcripts
  lib/store.ts             Concurrency-safe local JSON-file persistence (.aurelia/data/)
  lib/http-guard.ts        Loopback-only request check for the API routes
  lib/types.ts             Agent / Goal / Hermes-status domain types
  lib/mock-data.ts         Remaining mock data — swap for real gateway calls later
  lib/utils.ts             `cn()` class-merging helper
```

## Security notes

- `next.config.ts` sets baseline security headers (CSP, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) via `headers()`.
  Deliberately **not** set: `Strict-Transport-Security` — this is meant to run
  as a local/LAN tool over plain HTTP, and pinning HSTS on a `localhost`
  origin can lock a browser out of it for months.
- `npm run dev` / `npm run start` bind to `127.0.0.1` explicitly (Next.js
  defaults to `0.0.0.0`, i.e. reachable from anyone on the LAN). The
  `/api/sessions*` routes also check the `Host` header and reject anything
  that isn't `localhost`/`127.0.0.1` — belt-and-suspenders, since the network
  binding is the layer that actually keeps other machines out; a Host header
  can in principle be forged by a client on the same machine.
- Session ids from the URL are validated against a strict pattern before
  touching the filesystem, so there's no path-traversal surface in the
  session-events route.
- Once this talks to a real gateway, revisit the CSP's `connect-src` (to allow
  the gateway's origin) and consider auth for the dashboard itself, since
  nothing here is authenticated yet.
