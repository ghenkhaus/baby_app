# Contributing

Thanks for your interest in improving the Baby Registry Tracker!

## Getting started

1. Install [Node.js 20+](https://nodejs.org) and [Task](https://taskfile.dev).
2. `task install` — installs dependencies (uses `--legacy-peer-deps`, required
   by the Tailwind v4 + Vite 8 peer-dependency combination).
3. `task up` — runs the API (port 3001) and the Vite dev server (port 5173)
   together. Open http://localhost:5173.

Prefer raw npm? `npm install --legacy-peer-deps`, then run `npm run server` and
`npm run dev` in separate terminals.

## Before opening a PR

- `task build` must pass — it type-checks with `tsc` and builds the frontend.
- Run `task lint` and avoid introducing new warnings or errors.
- Keep changes focused, and describe what changed and why in the PR description.

## Conventions

- **`verbatimModuleSyntax` is on** — type-only imports must use
  `import type { ... }`.
- SQLite columns are `snake_case`; the API returns `camelCase`. `rowToItem()` in
  `server/index.ts` maps between them.
- Never commit `registry.db` or `.env` (both are gitignored).

See [CLAUDE.md](CLAUDE.md) for a deeper tour of the architecture, data model, and
API routes.
