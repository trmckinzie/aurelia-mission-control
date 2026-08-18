# AURELIA Mission Control

A local-first dashboard UI for the "Hermes" agent gateway — a HUD-style
command interface meant to sit in front of a locally-hosted AI agent system
(chat stream, live event log, active sub-agents, token/spend budget, and a
markdown "context canvas" showing whatever the agent is currently working
on).

## Current state

Two panels are wired to real data; the rest is still a **front-end UI shell**
backed by static mock data in [`src/lib/mock-data.ts`](src/lib/mock-data.ts):

- **Claude Code Sessions** (left sidebar) and **Session Event Log** (bottom
  left) read this project's actual Claude Code session transcripts —
  Claude Code writes one append-only JSONL file per session under
  `~/.claude/projects/<sanitized-cwd>/`. See
  [`src/lib/claude-sessions.ts`](src/lib/claude-sessions.ts) and the
  `/api/sessions` routes. Read-only, scoped to this project's own sessions
  only (derived from the server's own `process.cwd()`, never from a client
  value), and gated to loopback requests only.
- Chat stream, token/spend budget, and the context canvas are still mock
  data — no "Hermes gateway" backend exists yet. The header's "Hermes
  Gateway Connected" indicator is decorative for the same reason.

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
  app/                     App Router entry (layout, page, error/not-found)
  app/api/sessions/        Read-only Claude Code session data (this project only)
  components/dashboard/    AURELIA-specific panels (chat, telemetry, logs, canvas)
  components/ui/           shadcn/Base UI primitives
  lib/claude-sessions.ts   Reads/tails this project's local session transcripts
  lib/http-guard.ts        Loopback-only request check for the API routes
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
