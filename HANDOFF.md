# Handoff for the next session (written 2026-10-07)

Read `CLAUDE.md`, then this file, then `DEMO-ACCOUNTS.md`. Do not read `PRODUCT-ROADMAP.md`'s status table as truth: it is stale (Compass, Program Evaluation, Feature flags and the site redesign are all built; only Phase 8 "later" items are not).

## Update (launch build, all on `main`; nothing on `production`)
Built per the owner's final list: branch heads see Customer X only; page guards; survey Draft/Live/Closed with Close/Reopen and View responses; respondent-detail fields always shown; simple staff surveys (group builds once, ticks branches, one link+QR each; roster, personal links, lifecycle surveys, staff Closing the Loop and Sensitive categories retired; branch name hidden until 5 responses; editable anonymity line; viewers = owner + team members with the Colleague Pulse permission, granted by Admin); case rule (severe response opens a case, max 5 per location per day, "Make this a case" button, alert rules email only); billing safeguards (one open checkout, idempotency key, each Stripe event handled once); second "See pricing" button hidden while Pricing is off; marketing copy rewritten to real capabilities (COPY_REV 6 rewrites the stored copy on next deploy).
Deliberately left for later: evidence fusion, REACH, rosters, staff emails, staff cases. Group-level staff totals still exclude branches under 5 responses.
Not yet done: automated Playwright checks on staging and QA (owner declined QA for now). Delete the staging test location "Skyline Telecom – QA Floor Test" in Admin. Staging must be redeployed.

## Update 2 (everything on `main`)
Built: one role-aware Escalate button (shows who it goes to, confirm and note, inline result, Step back, full path history; "Raised by" originator on every case); REACH recommendation cards on Compass results (text editable in Admin -> Tooltips "Compass recommendations", Elevate emails a colleague); Platform Health now lists every scheduled job with last run, plus a setup checklist for email, AI, cron secret, Stripe and site address; email falls back to shipped templates; group staff totals include small branches; roster page, roster APIs and the two retired staff cron jobs removed; optional-email prompt on the survey; Customer/Colleague switch shows "Switching..." (raw speed not profiled); Customer X / Colleague X chapter spacing tightened.
Still needed outside the code: create the Render Cron Jobs (see Platform Health), set RESEND_API_KEY, ANTHROPIC_API_KEY, CRON_SECRET, Stripe keys and webhook, APP_URL.

## Rules from the owner (founder)
- **Nothing goes to `production`.** All work lands on `main` only. Never merge `main` into `production` without an explicit instruction in that message.
- Confirm before any wipe or reseed of staging, any real Stripe charge, or any real email to a non-`.test` address.
- Never ask for, print or commit secrets. Use environment variables only.
- Freeze: **no new features**. Fix bugs, close "last mile" gaps, and prove what exists works.
- Answer the owner in plain English: what is happening, what is not, what should be happening.

## Where things are
- Staging site: `https://oodelscore-staging.onrender.com` (Render; confirm which branch it deploys from, expected `main`).
- Staging database: Atlas project "Oodel Score Staging", cluster `Cluster0`, database name `test`. A staging-only user exists. The connection string is in the environment variable `STAGING_MONGODB_URI` (set in the cloud environment settings, not in the repo). The environment network policy allows the staging site and `*.v1iedl1.mongodb.net`. First task: test that a raw database connection from this environment works; if it does not, test through the website only.
- Logins: `DEMO-ACCOUNTS.md` (admin `admin.demo@oodelscore.com`, showcase accounts password `ocx123`).
- Admin → Dev Data Tools on staging has: Seed showcase data, Add colleague flows and polish data (safe to repeat), Recompute, Wipe all data. Do not press Wipe or Seed without asking.
- QA scorecard (184 checks, ticked by QA chat): https://claude.ai/code/artifact/47398fae-0252-419e-9dee-25134f71907e

## What is built (all on `main`, latest fixes after commit 5cf778a)
Everything in the spec and roadmap through Phase 7 plus: confidential (sensitive) cases visible only to the confidential contact with an access log; auto-created Decision Log drafts that must be confirmed; admin-editable colleague wording; group-of-5 anonymity floor; exit survey to work email with optional personal email (off by default); lifecycle surveys with go-live clock and send preview; product page guards; showcase and polish seed data; mobile layout fixes for the marketing site (media rules lost to `.mkt` specificity).

## QA status (latest pass, before the newest fixes were redeployed)
113 passed, 25 failed, 46 blocked of 184. Not a go. Section G (launch gate) has failures and G16 to G23 were never run; D17 to D22 were not run.

Fixed on `main` since, awaiting staging redeploy and re-test: demo requests now show in Admin → Contact messages; Analytics CSAT uses the designated CSAT question; clear messages for draft status changes and failed payments; Home tab title follows Site name; feedback point response counts link to responses; Admin tables scroll on phones; server-side page guard for Feedback Points; "Confidential" badge on group cases; explicit refusal when escalating a confidential case; anonymity banner on the group branch page; marketing mobile layout.

## Still open (unverified or not done)
- F2: Customer/Colleague switch takes over 10 seconds in QA (performance, not investigated).
- Only Feedback Points pages got a server-side page guard. Other pages hidden from the menu for restricted team members are guarded only at the API (data is protected, the empty page shell still opens). Consider a generic guard.
- Pages that could not be loaded on my old local stand-in database (Compass, Playbooks, Raw Feedback, Responses, Feedback Points responses, Roster send-links) must be checked on staging. Skyline Roster → Send links was empty on staging; press "Add colleague flows and polish data" then re-check.
- Alert rule semantics (owner decision pending): an alert fires when the period average drops below the limit, not on one very low response. Ask the owner if a single 1-star should open a case.
- Staging leftovers from QA: a resolved confidential case; test location "Skyline Telecom – QA Floor Test" (delete in Admin); QA may have triggered "Generate now" AI Insights (check Anthropic usage).
- Pricing was switched off in staging's Admin → Site content → Menu and footer. Owner to switch on.
- Tasks #121, #290, #292 to #294 in the old task list are stale: the work exists in code.

## Plan agreed with the owner (founder)
1. Feature freeze.
2. Draft a launch scope in three tiers for the owner to approve: Core (login and roles, QR and survey form, responses and dashboards, cases and alerts, billing, marketing site, Admin basics), Supporting (Group portal, Colleague Experience, owner to say if it is the first market), Beta hidden behind existing feature switches (Compass, Program Evaluation, Business Value, CX-EX correlation, Highlights, playbooks, etc.).
3. Test directly on staging from this environment with Playwright; turn the earlier crawl, overflow and permission checks into an automated suite in the repo (CI on every push). QA chats only for short exploratory passes on changed areas.
4. Definition of done for every feature: server-side rule, visible reason and error message, empty state, phone layout, demo data, passing automated check.
5. Keep QA rounds small: only what changed, fixed budget.

## Useful facts
- Next.js 16: read `node_modules/next/dist/docs/` before writing Next code (see `apps/web/AGENTS.md`).
- Lifecycle daily job: `curl -X POST -H "x-cron-secret: $CRON_SECRET" https://oodelscore-staging.onrender.com/api/cron/ce-lifecycle-triggers` (owner supplies the secret; only against `.test` data).
- Seed scripts in `packages/shared`: `npm run seed:colleague-flows`, `npm run seed:polish`, `wipe-and-reseed-showcase.ts` (destructive; needs `SEED_TARGET_DB`; staging database name is `test`).
- `git push` to GitHub sometimes returns a temporary 500; retry after a few seconds.
- Previous local test rig (FerretDB plus Playwright scripts) lived in `/tmp` and is gone; rebuild only if staging access fails.
