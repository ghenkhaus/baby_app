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

CI runs on every pull request and **must pass before merging** — it builds the
frontend and runs the linter. Run the same checks locally first:

- `task check` runs both, and is the one command to run before opening a PR:
  - `task build` — type-checks with `tsc` and builds the frontend.
  - `task lint` — ESLint must pass with no errors (lint errors block CI;
    warnings don't).
- Keep changes focused, and describe what changed and why in the PR description.

`main` is protected: changes land through a pull request with passing CI, and
review conversations must be resolved before merge.

## Conventions

- **`verbatimModuleSyntax` is on** — type-only imports must use
  `import type { ... }`.
- SQLite columns are `snake_case`; the API returns `camelCase`. `rowToItem()` in
  `server/index.ts` maps between them.
- Never commit `registry.db` or `.env` (both are gitignored).

See [CLAUDE.md](CLAUDE.md) for a deeper tour of the architecture, data model, and
API routes.
