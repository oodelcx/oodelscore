# Oodel Score — project context

This repo is the real implementation of Oodel Score, a B2B feedback-intelligence platform. A business puts up a QR code, customers answer a short survey, and the business gets AI-analyzed dashboards instead of a spreadsheet of comments nobody reads.

## Before making changes, read these in order

1. `/docs/design/oodel-score-engineering-spec.md` — the full spec: MongoDB data model for every collection, the role/permission matrix, Stripe billing logic (including the per-branch "who pays" rule), the CX Pulse scoring framework, every Resend email trigger, and a list of known bugs to fix during migration, not after.
2. The HTML mockups in `/docs/design/` — these are the exact, click-tested visual and interaction spec. Open them in a browser; every button, modal, and page transition shown is real and intentional, not decorative:
   - `oodel-score-admin-rebuild.html` — Oodel Score's internal Admin portal
   - `oodel-score-group-dashboard.html` — the Parent Organization (Group) portal, for accounts managing multiple businesses
   - `oodel-score-redesign.html` — the standalone Business portal (single location, no parent org)
   - `oodel-score-business-branch-mode.html` — the Business portal when it belongs to a Parent Org (same portal as above, plus a conditional group-context layer — see the spec's Section on this; it is **one** dashboard with conditional rendering, not a separate codebase)
   - `oodel-score-marketing-site.html` — the public marketing site: Home, Product, Solutions, Pricing, Company (5 pages)
   - `oodel-score-feedback-form.html` — the actual respondent-facing survey a customer sees after scanning a QR code, in both layout modes (all questions on one screen / one question per screen)

## Stack

MongoDB · Render (hosting) · Stripe (billing) · Resend (transactional email) · Claude API (AI Insights generation — use `claude-haiku-4-5-20251001` via Batch API, see spec Section 10).

## Current state

Live site: oodelscore.com, currently built via Emergent. This repo is the target for the rebuild described in the spec. Before writing new code, check what already exists here that partially matches the spec — don't assume a blank slate.

## Working agreement

- Read the spec and all mockups fully before proposing any implementation plan. Reconcile the plan against what's actually in this codebase before writing code.
- Work in small, reviewable increments, one phase at a time per the build order in the spec (Section 14): data model → auth/RBAC → core CRUD → Stripe → Resend → AI insights pipeline → Act layer (Action Board/Decision Log/Playbooks) → CX Pulse → frontend → staging → production.
- Fix the known bugs listed in the spec (Section 13 — the NPS/star score-blending bug, orphaned billing records, the universal "Invite Expired" pattern, a suspicious duplicate alert recipient) as part of the relevant migration step, not as an afterthought.
- Never push directly to whatever branch deploys to production. Work on a separate branch/staging environment until a phase is reviewed.
- Confirm before any real Stripe charge, real Resend send to a non-test address, or any other action with a real-world side effect outside a sandbox/test environment.
- The permission matrix in the spec (Section 4) must be enforced server-side, not just hidden in the UI — billing assignment and survey/question configuration are Admin-only fields; reject writes to them from Group/Business-level API calls even if present in the request body.
