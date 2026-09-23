# Oodel Score

Monorepo for the Oodel Score rebuild. See `CLAUDE.md` and `oodel-score-engineering-spec.md` (repo root) before making changes.

## Structure

- `apps/web` — Next.js app: marketing site, all four dashboards, feedback form, and the API routes backing them, including every scheduled job (see "Scheduled jobs" below — there is no separate worker process)
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

`npm run seed` reads `MONGODB_URI` from the environment — export it from `.env` or run with `node --env-file=.env`.

## Scheduled jobs

Every timed job (spec Section 10a) is an HTTP route in `apps/web`, called on a schedule by an external scheduler (a Render Cron Job per row). None of them run on their own — there is no in-process job runner. Each is a `POST` authenticated by an `x-cron-secret` header matching `CRON_SECRET`, the same way the Stripe webhook is authenticated by its signature rather than a login.

| Cadence | Endpoint | Run by hand |
|---|---|---|
| Daily | `POST /api/cron/generate-insights` | — |
| Daily | `POST /api/cron/measure-decisions` | — |
| Hourly | `POST /api/cron/evaluate-baseline-alerts` | `npm run evaluate:baseline-alerts` |
| Nightly | `POST /api/cron/recompute-cx-pulse` | `npm run recompute:cx-pulse` |
| Hourly | `POST /api/cron/auto-escalate-cases` | — |
| Daily | `POST /api/cron/comp-expiry-reminders` | — |

All six are real, wired routes — set up a Render Cron Job for each one, not just the four listed above in earlier docs. Missing either of the last two silently means overdue cases never auto-escalate and comp/pilot accounts never get their expiry reminder, not a crash — check Admin → Platform Health if either looks like it's stopped firing.

```
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://oodelcx.com/api/cron/recompute-cx-pulse
```

A route with no `CRON_SECRET` configured returns 500 rather than running unauthenticated.

## One-off scripts

```
npm run check:billing-integrity                 # report orphaned / double-billed subscription rows
npm run backfill:subscription-mrr               # report subscriptions whose mrrValue disagrees with Stripe
npm run backfill:subscription-mrr -- --apply    # ...and write the corrected values
```
