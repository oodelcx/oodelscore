# Status

Living record of what's live, what's merged-but-not-deployed, and what's open. Updated as part of every PR that changes deploy state — if you're an AI session picking this up cold, read this file first, then check the PRs it links for the full diff/discussion.

**How this repo deploys:** all work lands on `main` via PR. `production` is the branch DNS/hosting actually serve (oodelcx.com) — merging `main` → `production` is a real deploy to real customers, done only with explicit user confirmation, never automatically.

---

## Production (oodelcx.com)

Last confirmed deploy: PR #93+94 (see git history around that merge for exact commit). Nothing from the QA-fix cycle below has been deployed to production yet — it's all sitting in `main`, waiting on an explicit go-ahead.

## `main` (merged, not yet on production)

- **PR #160** — Security fix: unauthenticated `GET /api/feedback/<qrToken>` was leaking the entire internal `Business` document nested inside `demographicConfig` for Colleague Experience feedback points. Fixed by building a plain object instead of spreading a live Mongoose subdocument. Verified.
- **PR #161** — QA round-1 fixes: scan-token consumed before validation (fixed, verified), missing case-linking UI on Improvement Initiatives (fixed, verified), 7 forms not syncing their product tab to the server-resolved value (fixed, verified), Amani's seeded responses missing `eventId` (fixed), cookie banner label inconsistency (fixed), CX Goal % not clamped (fixed), Group Colleague Pulse mislabeled "CX Pulse" (fixed). The CX Pulse/Insights-not-populating item in this PR was *incomplete* — see PR #162.

## Open PRs (not yet merged)

- **[PR #162](https://github.com/oodelcx/oodelscore/pull/162)** — `CxPulseScore` and `Category` both carry a stale pre-Colleague-Experience unique index that Mongoose never drops on its own. For `CxPulseScore` this wasn't just stale — it actively crashed `recomputeAllCxPulseScores()` for any dual-product account (duplicate-key error on the old 3-field index), which is why PR #161's CX Pulse fix only got CX Pulse to a "no longer silently empty, now openly broken" state. Fix: `connectToDatabase()` now runs `syncIndexes()` on both models once per process on connect, so every environment self-heals without a manual migration step. Needs merge + re-verification that CX Pulse recompute actually completes for a dual-product account.
- **(branch `claude/minor-bugfixes-and-status`, PR not yet opened as of this commit — check GitHub for its number)** — the 6 remaining minor/cosmetic items below, all fixed:
  - Alert Rules: added in-place edit (threshold/sensitivity/drop%/recipients) to both Business and Group clients — backend already supported it via PATCH, only the UI was missing.
  - Owner badge: business/team's owner label flipped to `"Owner (Business Name)"` so `OwnerBadge` reads "Owner" instead of the business's own name. Both Business and Group Team Members lists now include the primary owner login as a row (previously silently omitted).
  - Group Raw Feedback: added a per-branch filter dropdown (`businessId` query param, org-scoped server-side).
  - Permission-blocked pages: `business/layout.tsx` and `group/layout.tsx` now resolve the current route to its `TeamPageKey` and render a shared `<AccessDenied/>` component server-side when a Team Member's permissions don't cover it, instead of a client page silently rendering an empty/broken state off a 403.
  - Branches list: added click-to-sort on every column (client-side).
  - Group branch QR links: `/api/group/branches/[id]` now returns the branch's active feedback points; the branch detail page shows a QR-link card reusing the existing `QrModal` component, backed by a new scoped poster route (`/print/group-branch-feedback-point/[fpId]`).

## Known issues — not yet fixed

None outstanding from the QA pass as of this commit — the 9 minor items are now either fixed (6, see above and PR #161) or explicitly out of scope (contact-email inconsistency is stale CMS data, not code; "Dashboard has no case-count stat" was flagged by QA itself as possibly intentional).

## How to pick this up in a new session

1. Read this file.
2. `git log origin/main --oneline -10` to confirm nothing's changed since the "Production" / "main" sections above were last updated.
3. Check `gh`/GitHub for any PRs opened after the ones listed here.
4. If something in this file looks stale, trust the git history over this file's prose, and fix this file to match while you're there.
