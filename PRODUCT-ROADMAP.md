# Product roadmap — post-launch feature phases

This is the phased plan agreed with the product owner for everything built on top of the initial migration (which followed the spec's own Section 14 build order). It exists so the plan survives context resets across sessions — **read this before starting or resuming any phase below**, and update the status table as work lands.

Each phase ships the same way: a feature branch off `main`, `npm run typecheck` and `npm run build` verified clean before every push, a PR opened and merged into `main` — never straight to `production`. Merging `main` → `production` is a separate, always-confirmed-first step once a phase is reviewed and approved on `main`.

## Status

| Phase | Name | Status |
|---|---|---|
| 0 | Lock the ANCHOR/REACH/5-Cs naming (Compass + Act layer) | **Locked** — all three frameworks confirmed, see §0 below |
| 1 | CSAT/CES + honest before/after | Done — CSAT gap fixed, PR #185, merged |
| 2 | Attention Centre | Done — conformance fixes shipped, PR #186, merged |
| 3 | De-escalation | Done |
| 4 | Closing the loop (CX + EX halves) | Done |
| 5 | Business Value / £/$ module | Done — top-account-only editing added, see §5a below |
| 6 | Business-side survey builder | Done — centralized to Group for branches, see §6a below |
| 7 | OodelCX Compass (7a–7d) | **Not started** — unblocked now that naming is locked |
| 8 | Everything marked "later" | **Not started** |

Fix batches landed as: PR #182 (QA fix batch — question text, escalation UX, Closing the Loop/Attention Centre redesigns, seed data), PR #183 (this file, wired into CLAUDE.md), PR #184 (full Compass/Attention Centre/Business Value scope), PR #185 (CSAT designated-question fix), PR #186 (Attention Centre conformance: escalation-deadline warning, unassigned-first sort, red flag). All merged into `main`. PR #187 (branch-aware Feedback Points builder). Branch `feat/centralize-survey-value-build` (not yet merged): centralizes survey building to Group for branches, narrows Business Value editing to the top account only, renames CX Pulse's dimension display labels to stop colliding with Compass's ANCHOR, auto-chains the Act layer (Improvement Initiative → Decision Log → Closing the Loop), and surfaces recurring-issue flags inside Case Management itself — see §6a/§5a/§0a/§4a/§2a below.

### §6a — Survey building: Group-only for branches (this branch)

Confirmed by the product owner: a branch must never get its own self-service survey builder, or every branch ends up with its own survey and the network drifts. Only a Group (parent org) or a standalone business (its own top account) builds surveys. For a branch, Group now has a new **Feedback Points** section (`/group/feedback-points`) that picks the branch first, then builds the same way the Business builder always has (template → questions → quota). `POST /api/business/feedback-points` now 403s for a branch's own login. Shared create-validation logic lives in `packages/shared/src/feedback/surveyBuilder.ts` so both routes stay in sync.

### §5a — Business Value: top-account-only editing (this branch)

Confirmed by the product owner: only the actual owner login of the top-level account — the Group owner for a branch, or the business owner itself if standalone — may edit Business Value inputs. A team member of any tier, and a branch's own login, can view but not write. `PATCH /api/business/business-value` now rejects both; the Group portal's Business Value page, previously pure read-only rollup, gained real per-branch edit UI (`PATCH /api/group/business-value` with `businessId`).

### §0a — CX Pulse dimension labels renamed off ANCHOR's words (this branch)

CX Pulse (the pre-existing feedback-maturity framework, unrelated to Compass) used `Ownership`/`Culture` as two of its five dimension labels — an exact word collision with two of ANCHOR's six letters (Culture, Ownership), confusing "your CX Pulse Culture score" with "your Compass Culture gate." *Display* labels only were renamed: Awareness→Signal, Response→Speed, Ownership→Accountability, Culture→Buy-in, Outcome→Impact. Schema field names (`awareness/response/ownership/culture/outcome`) are unchanged — no data migration. Ladder stage names (Collecting→Embedded) are unchanged, since they don't collide with anything ANCHOR/REACH-named.

### §4a — Act layer auto-chained (this branch)

An Improvement Initiative's "Log outcome →" button now opens Decision Log pre-filled with the initiative's title/pattern and a new `DecisionLogEntry.linkedInitiativeId` field. A measured Decision Log entry for a *Colleague Experience* decision gets a "Close the loop →" button that opens the Closing the Loop composer pre-filled with `linkedDecisionId` and seeded draft text (the ClosingLoopUpdate API already accepted these fields — they were never sent by any form before this). The Improvement Initiatives page now shows the linked Decision Log entry + Closing the Loop update inline. "Close the loop" is CE-only by design — the CX half of closing the loop is a per-response reply from Case Management, since CX respondents aren't anonymous, while ClosingLoopUpdate is the CE-only roster broadcast (CE responses are anonymous).

### §2a — Recurring-issue flags surfaced in Case Management (this branch)

The `RecurringIssueFlag` system already auto-computed patterns and surfaced them on the Dashboard widget and Improvement Initiatives page, but never inside Case Management itself — where a user is actually working the cases. Added the same "Suggested — recurring patterns" card (convert to initiative / dismiss) to the top of both the Business and Group Case Management pages, reusing the existing `/api/{business,group}/recurring-issues` endpoints.

## Phase 0 — Naming, locked

Three frameworks, confirmed by the product owner:

- **ANCHOR** (Compass's six assessment dimensions — §7 below): **A**uthority, **N**umbers (Net-worth), **C**ulture, **H**earing, **O**wnership, **R**hythm.
- **REACH** (the recommendation-engine's five principles — how a Compass finding turns into an actionable nudge, feeding Phase 7d's recommendation engine): **R**ecognize, **E**levate, **A**lign, **C**onnect, **H**abituate.
- **5 Cs** (the Act-layer/case lifecycle naming — Capture, Clarify, Claim, Close, Confirm): applied to the existing case lifecycle already built in Case Management/Decision Log/Closing the Loop. Working assumption, to confirm: **Capture** = a response becomes a case; **Clarify** = triage/categorize/assign a category; **Claim** = an owner is assigned; **Close** = the case is resolved; **Confirm** = the resolution is confirmed back (Decision Log's before/after measurement, and/or Closing the Loop's "you said, we did"). If this mapping is wrong, correct it before it gets used as UI copy anywhere.

Nothing here is Qualtrics-overlapping vocabulary. **Phase 7 (Compass) is now unblocked.**

## Scope decisions — what got dropped or merged, and why

Three real overlaps were caught before they turned into duplicate features:

1. **"Closed-Loop Verification" is not a separate feature** — it's the same question as Decision Log's before/after ("did the action actually work?"). Its intent folds entirely into the Decision Log confidence-graded before/after (Phase 1). Never build it as its own screen.
2. **"Proactive Recovery" is not a separate feature** — it's the CX half of Closing the Loop (Phase 4): reaching back out to the customer once something's fixed. One mechanism, one name.
3. **Attention Centre, 1BYTE, and Ask OodelCX are one engine, three delivery formats**, not three separate "what needs attention" brains:
   - **Attention Centre** (Phase 2, done) does the actual computation — what needs attention, why, who's responsible.
   - **1BYTE** (Phase 8) just reads that same output aloud on a schedule.
   - **Ask OodelCX** (Phase 8) just answers questions against that same output plus the raw data behind it.
   - Neither 1BYTE nor Ask OodelCX gets its own logic for deciding what matters — only Attention Centre's engine decides that, ever.

**Command Center vs. Attention Centre — the line between them, on purpose:** Command Center answers "how are we doing" (scores, trends, charts — the existing executive KPI dashboard). Attention Centre answers "what do I need to do right now" (a queue, sorted by urgency). Alerts is not a third landing page competing with these two — it's a raw feed that feeds into Attention Centre.

## Phase 1 — CSAT/CES + honest before/after — DONE

Shipped: `ces_1_5` question type with inverted scoring; `csatPercent`/`cesAverage`/`cesLowEffortPercent` computed in `packages/shared/src/scoring/aggregate.ts`; NPS/CSAT/CES surfaced together on Analytics, Command Center, CX Pulse; Decision Log confidence label + sample-size warning. CSAT's blended-star-questions gap (found on reconciliation) was fixed in PR #185: `IQuestion.isCsatQuestion`, Admin-set on the Question Template editor, at most one per template — `csatPercent` now only counts answers to that specific question, returning `null` (not a fabricated 0%) until one is marked.

## Phase 2 — Attention Centre — DONE

**What it is:** the first screen a logged-in owner or team member sees (after the one-time Compass assessment, for new customers, once Phase 7 exists) — a prioritized queue of everything currently needing a human decision, across every part of the product, in one place.

**What feeds it — nothing new needs collecting:**
- Cases that are overdue or unassigned
- Cases approaching their escalation deadline
- Newly fired Alerts not yet acknowledged
- Playbook Runs triggered but not yet started or finished
- Improvement Initiatives awaiting a decision
- Decision Log entries whose "after" measurement window has passed and is ready to review
- (once Compass exists) a re-assessment due, or a priority gap that's gotten worse
- (once AI Insight Reports are reviewed) a report just generated with a notable finding worth acting on

**What each item shows:**
- **What** — one plain sentence describing the issue
- **Where** — which branch/team/category
- **Who** — who it's assigned to right now, with **"Unassigned" flagged in red** if nobody owns it yet
- **Why now** — why it's surfacing today specifically ("48 hours overdue," "3rd time this month," "escalation deadline in 4 hours")
- One button that takes them straight into resolving it — never just "view," always the actual next action

**Sort order — fixed and deterministic, never AI-ranked:** overdue escalations first, then unassigned high-severity cases, then approaching deadlines, then everything else.

**Permissions:** reuses the existing permission system exactly — an owner sees everything across their business (or every branch, for a Group owner, with a branch column added); a team member sees only what's theirs or in their scope. No new access logic.

Conformance verified and fixed in PR #186: added `escalation_deadline_approaching` as its own `ATTENTION_KINDS` entry (previously only overdue-by-`dueDate` cases existed, nothing for a case still on time but about to breach its escalation SLA), unassigned-before-assigned as a sort tiebreak within a severity band, and the "Unassigned" red-flag treatment in the frontend.

## Phase 3 — De-escalation — DONE

Append-only event log, a reason field, a computed "current level." Self-contained.

## Phase 4 — Closing the loop — DONE

- **CX half:** a consent checkbox + contact field on the feedback form, plus a small "recent improvements" notice board.
- **EX half:** an anonymous broadcast composer for the business, scoped to a team/branch, never an individual.

## Phase 5 — Business Value / £/$ module — DONE, needs a field-shape check

**The exact four standard fields, per business, entered once in a settings screen:**
1. **Average value per customer visit/transaction (£)** — the business's own number
2. **Average visits per customer per year** — the business's own number, used to estimate lifetime value
3. **Estimated cost to acquire a new customer (£)** — optional; more advanced businesses will have this, others won't
4. **What counts as "a customer at risk of leaving"** — manually defined for now (e.g. "an NPS detractor score"); a future version may let OodelCX infer this from history instead of asking

Same four fields for every customer (one calculation engine for everybody); the *values* typed into them are entirely business-specific. **Check the shipped `IBusinessValueInputs` shape** (`packages/shared/src/models/Business.ts`) against this exact field list — it currently has `avgTransactionValue`, `visitsPerYear`, `acquisitionCost`, `atRiskStarThreshold`, `currencySymbol`. `atRiskStarThreshold` is a numeric proxy for field 4 above ("at risk" = a star answer at or below this threshold) — confirm this reads as "manually defined, star-based" per the agreed design, or whether it should be a broader/more explicit "at risk" definition (e.g. also NPS-detractor-based, per the example given: "an NPS detractor score").

## Phase 6 — Business-side survey builder — DONE

"Business-built surveys, from templates + quota" — templated, not fully freeform.

**What actually changed, and what stayed Admin-only:** before this phase, a business had zero ability to create or edit a `FeedbackPoint` at all — confirmed by reading the code, not assumed — every point was Admin-created, and `FeedbackPointRequest`'s own comment said so explicitly ("businesses can't create these themselves"). This phase adds real self-service creation (confirmed with the product owner as immediate/live, not routed through Admin approval first), but narrowly: a business picks an Admin-authored `QuestionTemplate` already available to its product(s), chooses which of that template's *existing* questions to include and in what order, sets an optional response quota, and names/describes the point. It never gets to write new question text, categories, or touch the template itself — that's enforced by construction (the create route never accepts those fields), not by a rejected-field check layered on top.

**Shipped:**
- `FeedbackPoint.selectedQuestionIds` (ordered subset of the parent template's question ids; `null` = full template, unaffected for every pre-existing point) and `FeedbackPoint.responseQuota` (auto-closes once reached, reusing the `startsAt`/`endsAt` auto-close pattern already built for Events).
- `effectiveQuestions()` — the one function both the public GET (render) and submit (validate + persist) routes now derive their question list from, so the two routes can never disagree about what index N refers to.
- `GET /api/business/feedback-points/templates` — read-only list of templates available to the business's product(s).
- `POST /api/business/feedback-points` — the actual create path, enforcing the existing `maxFeedbackPoints` seat limit the same way the Admin creation route already does.
- A "+ Build a survey" flow on the Business Feedback Points page: template picker → checkbox+reorder question list → quota → create.

## Phase 7 — OodelCX Compass (7a–7d) — NOT STARTED, unblocked

### The ANCHOR assessment question bank

Six dimensions. Four are asked once regardless of which product(s) an account has (they're about the org's general approach, not the listening mechanism); two have a CX version and an EX version, and which version(s) a customer sees is decided automatically by which products are enabled on their account (`hasProduct` — no manual configuration needed).

**Authority** (asked once)
- Does a named senior leader own experience management as part of their actual role?
- Is experience performance reviewed at leadership level, on a regular schedule?
- Are there formal objectives tied to experience outcomes?

**Numbers** (Net-worth) (asked once)
- Can you currently point to a specific business outcome (retention, cost, revenue) that improved because of an experience change?
- Is spend on experience management justified with numbers, or mostly on instinct?

**Culture** (asked once)
- Do frontline staff regularly see the feedback customers/colleagues give about their own area?
- Are managers held accountable for experience outcomes in their performance reviews?

**Hearing — CX version** (shown if `customer_experience` is enabled)
- How do you currently collect customer feedback — one method, or several combined?
- How often is that feedback actually reviewed by someone, not just collected?

**Hearing — EX version** (shown if `colleague_experience` is enabled)
- How do you currently check in on colleague sentiment — one-off, or on a regular cadence?
- Are different roles/teams measured separately, or only the organization as a whole?

**Ownership — CX version**
- When a customer reports a problem, is it assigned to a specific person, or handled informally?
- Are unresolved customer issues tracked to a close, or do they just fade out?

**Ownership — EX version**
- When a colleague raises a concern (even anonymously, in aggregate), does anything visibly happen as a result?
- Is there a defined path for an EX concern to reach the right manager without breaking anonymity?

**Rhythm** (asked once)
- When the same problem comes up repeatedly, does it typically trigger a structural change (new training, new process), or does each instance just get handled individually?

**Length:** a single-product customer answers ~28–32 questions total (the shared ~12, plus one flavor of Hearing/Ownership). A dual-product customer answers both flavors of Hearing and Ownership, landing ~36–40. Describe the length as "25–40 questions," not a fixed number — it scales with which products the account actually uses.

### REACH — the recommendation engine's five principles

Each Compass finding's recommendation (Phase 7d) is built around one or more of: **R**ecognize (name the gap in plain language), **E**levate (make it visible to whoever owns it), **A**lign (tie it to a goal/objective already in the system — e.g. a CX Goal), **C**onnect (deep-link into the actual feature that closes the gap — "Set up Category Owners →"), **H**abituate (turn the fix into a recurring habit/cadence, not a one-off — e.g. a Playbook trigger or a CX Pulse re-check).

### Sub-phases

- **7a** — data model + the gate-based scoring engine, backend only, fully testable before any screen exists. Unblocked now that ANCHOR/REACH are locked; the exact gate thresholds (how a dimension's answers combine into a score, how dimension scores combine into an Established/Emerging stage) still need the product owner's numbers before 7a can be finished — the *mechanism* (gates, not a raw average) is agreed, the *thresholds* are not yet.
- **7b** — the assessment-taking flow (the ladder-question UI)
- **7c** — the results page (Established/Emerging stage, ANCHOR bands, evidence text)
- **7d** — the recommendation engine (REACH, above) + deep links into the rest of the product (e.g. "Set up Category Owners →," "Configure Escalation Rules →" — these must point at features already in their final shape, which is why Compass is sequenced after CSAT/CES and Attention Centre)

## Phase 8 — Everything marked "later" — NOT STARTED

- **Ask OodelCX** — shares Attention Centre's engine and the raw data behind it; no separate "what matters" logic. Waits on Phase 2 (done).
- **1BYTE** — reads Attention Centre's output aloud on a schedule; no separate logic. Same dependency as Ask OodelCX, plus needs an actual TTS vendor decision (external cost, not just build time).
- **Agent Queue** (human-approved AI actions) — needs enough of the above built that there's something real to suggest, plus the human-approval UI.
- **Evidence fusion** (assessment vs. real activity) — explicitly needs Compass (Phase 7) live with real historical answers to compare against.
- **External Feedback, Integrations** — no blocker, just genuinely lower priority than everything above.

## Master feature list (for reference — cross-check before starting any phase)

| Feature | Status | Notes |
|---|---|---|
| **LISTEN** | | |
| QR feedback collection, 9 question types | Built | |
| CES (effort score) question type | Built | 10th question type, inverted scoring |
| CSAT as a formally reported metric | Built, gap found | See Phase 1 gap above — needs business-designated question, not a blend |
| Colleague Experience surveys, roster-based | Built | Three-layered anonymity mechanism |
| Events | Built | |
| Business-built surveys, from templates + quota | To build | Phase 6 |
| **UNDERSTAND** | | |
| Theme Intelligence, Driver Analysis, Root Cause (Investigation) | Built | |
| CX Pulse | Built | NPS/CSAT/CES trio added to its breakdown view |
| AI Insight Reports | Built | Becomes one output format of the shared attention-engine, not standalone logic |
| Ask OodelCX | To build (later) | Phase 8 — shares Attention Centre's engine |
| **ACT** | | |
| Case Management, Category Owners, Playbooks, Alerts, Goals | Built | |
| Attention Centre | Built | Default landing page; see Phase 2 conformance check |
| Agent Queue (human-approved AI actions) | To build (later) | Phase 8 |
| **ESCALATE** | | |
| Escalation hierarchy + rules | Built | |
| De-escalation, with permanent history | Built | Append-only event log |
| **PROVE** | | |
| Decision Log, before/after | Built, tweaked | Confidence label, sample-size warning, driver-specific check added |
| Improvement Initiatives | Built | |
| Closing the loop (CX consent-based + EX anonymous broadcast) | Built | |
| Business Value / £/$ conversion | Built | See Phase 5 field-shape check |
| **LEARN / ASSESS** | | |
| OodelCX Compass (assessment, ANCHOR, REACH) | To build | Phase 7 — ANCHOR locked, REACH still open |
| Re-assessment + progress tracking | To build (Compass phase 2) | |
| Evidence fusion (assessment vs. real activity) | To build (later) | Phase 8 |
| 1BYTE | To build (later) | Phase 8 |
| **UNDERNEATH EVERYTHING** | | |
| Billing, roles & permissions | Built | |
| Nav redesign, visual refresh | Built | |
| External Feedback, Integrations | To build (later, low priority) | Phase 8 |
