# Oodel Score

Monorepo for the Oodel Score rebuild. See `CLAUDE.md` and `oodel-score-engineering-spec.md` (repo root) before making changes.

## Structure

- `apps/web` — Next.js app: marketing site, all four dashboards, feedback form, and the API routes backing them
- `apps/worker` — scheduled-jobs entry point (AI Insights, CX Pulse scoring, alert sweeps), run via Render Cron Jobs
- `packages/shared` — Mongoose schemas/types for every collection in the spec, DB connection helper, seed data

## Setup

```
npm install
cp .env.example .env   # fill in MONGODB_URI
```

## Commands

```
npm run dev          # apps/web dev server
npm run build         # apps/web production build
npm run seed          # seed system roles, email templates, CX Pulse framework defaults
npm run typecheck     # typecheck every workspace
```

`npm run seed` and `apps/worker` read `MONGODB_URI` from the environment — export it from `.env` or run with `node --env-file=.env`.
