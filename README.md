# AURELIA Mission Control

A local-first dashboard UI for the "Hermes" agent gateway — a HUD-style
command interface meant to sit in front of a locally-hosted AI agent system
(chat stream, live event log, active sub-agents, token/spend budget, and a
markdown "context canvas" showing whatever the agent is currently working
on).

## Current state

This is a **front-end UI shell**. Every screen renders from static mock data
in [`src/lib/mock-data.ts`](src/lib/mock-data.ts) — there is no backend, no
API route, no WebSocket/SSE connection, and no environment configuration yet.
The "Gateway Log" panel simulates a live event stream client-side with
`setInterval`; nothing is actually being read from a running gateway.

Wiring this up to a real backend (the Hermes gateway itself) is the next
milestone.

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
  app/                  App Router entry (layout, page, error/not-found)
  components/dashboard/ AURELIA-specific panels (chat, telemetry, logs, canvas)
  components/ui/        shadcn/Base UI primitives
  lib/mock-data.ts      All current data — swap for real gateway calls later
  lib/utils.ts          `cn()` class-merging helper
```

## Security notes

- `next.config.ts` sets baseline security headers (CSP, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) via `headers()`.
  Deliberately **not** set: `Strict-Transport-Security` — this is meant to run
  as a local/LAN tool over plain HTTP, and pinning HSTS on a `localhost`
  origin can lock a browser out of it for months.
- Once this talks to a real gateway, revisit the CSP's `connect-src` (to allow
  the gateway's origin) and consider auth for the dashboard itself, since
  nothing here is authenticated yet.
