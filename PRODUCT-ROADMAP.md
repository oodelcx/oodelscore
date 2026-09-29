# Product roadmap — post-launch feature phases

This is the phased plan agreed with the product owner for everything built on top of the initial migration (which followed the spec's own Section 14 build order). It exists so the plan survives context resets across sessions — **read this before starting or resuming any phase below**, and update the status table as work lands.

Each phase ships the same way: a feature branch off `main`, `npm run typecheck` and `npm run build` verified clean before every push, a PR opened and merged into `main` — never straight to `production`. Merging `main` → `production` is a separate, always-confirmed-first step once a phase is reviewed and approved on `main`.

## Status

| Phase | Name | Status |
|---|---|---|
| 0 | Lock the ANCHOR/REACH naming (Compass) | **Partially locked** — ANCHOR dimensions confirmed (§2 below); REACH still undefined, blocks 7 only |
| 1 | CSAT/CES + honest before/after | Done, **known gap found** — see §4 below |
| 2 | Attention Centre | Done — needs a conformance check against the full spec in §1 below |
| 3 | De-escalation | Done |
| 4 | Closing the loop (CX + EX halves) | Done |
| 5 | Business Value / £/$ module | Done — needs a field-shape check against §3 below |
| 6 | Business-side survey builder | **Not started** — needs explicit go-ahead (loosens an Admin-only permission rule) |
| 7 | OodelCX Compass (7a–7d) | **Not started** — blocked on Phase 0 (REACH) |
| 8 | Everything marked "later" | **Not started** |

A QA fix batch (question text in case trail, escalation UX clarity, Closing the Loop redesign, Attention Centre redesign, heavier seed data) landed on top of Phases 1–5 as PR #182, merged into `main`. Docs infra (this file + its link from CLAUDE.md) landed as PR #183.

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

## Phase 0 — Lock the naming

**ANCHOR is confirmed as the acronym for the six assessment dimensions** (see §2 below): **A**uthority, **N**et Value, **C**ulture, **H**earing, **O**wnership, **R**enewal. These are generic business-maturity terms, not Qualtrics-specific vocabulary — low overlap risk as named.

**REACH is still undefined.** It was named alongside ANCHOR in the original phase plan (as the stage-ladder / overall scoring-system name, distinct from the six ANCHOR dimensions and from the "Established/Emerging" stage labels), but no definition for it has been written down anywhere — not in this doc, not in the codebase, not in the spec. **This is the one open item blocking Phase 7.** Needs the product owner to define: what REACH stands for/represents, and how ANCHOR dimension scores + gates combine into a stage (the "gate-based scoring mechanism").

This blocks Phase 7 only — everything else can proceed in parallel.

## Phase 1 — CSAT/CES + honest before/after — DONE, with a known gap

Shipped: `ces_1_5` question type with inverted scoring; `csatPercent`/`cesAverage`/`cesLowEffortPercent` computed in `packages/shared/src/scoring/aggregate.ts`; NPS/CSAT/CES surfaced together on Analytics, Command Center, CX Pulse; Decision Log confidence label + sample-size warning.

**Gap found on reconciliation:** the agreed design is "a business marks which question in their survey is *the* CSAT question" (a specific, named question) — but the current implementation computes CSAT as top-2-box across **every** `star_1_5` answer in range, blending multiple star questions together (e.g., "friendliness" and "cleanliness" both feed the same CSAT number). This is the same shape of bug as the original NPS/star-blending issue fixed at migration — just one level down, between different star questions instead of between star and NPS. **Needs a follow-up fix:** a business-designated CSAT question (e.g. a `csatQuestionId` on `Business`, defaulting to null/unset until chosen), with `csatPercent` computed only from answers to that specific question.

## Phase 2 — Attention Centre — DONE, needs a conformance check

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

**Conformance check needed against the shipped implementation** (`packages/shared/src/scoring/attentionCentre.ts` + `apps/web/src/components/attention-centre.tsx`): confirm the "Unassigned" red-flag treatment exists, confirm the sort order matches this exact rule order, confirm Decision Log "ready to review" and Improvement Initiative "awaiting decision" item kinds are covered (the engine's `ATTENTION_KINDS` list should be checked against this spec's source list above).

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

## Phase 6 — Business-side survey builder — NOT STARTED

"Business-built surveys, from templates + quota" — templated, not fully freeform (start from existing templates, apply a quota mechanism). Deliberately isolated because it means loosening a rule that's currently hard and server-enforced ("survey/question configuration are Admin-only... reject writes... even if present in the request body" — CLAUDE.md's Working agreement). Needs its own careful review, not bundled into a bigger PR.

## Phase 7 — OodelCX Compass (7a–7d) — NOT STARTED, blocked on Phase 0 (REACH)

### The ANCHOR assessment question bank

Six dimensions. Four are asked once regardless of which product(s) an account has (they're about the org's general approach, not the listening mechanism); two have a CX version and an EX version, and which version(s) a customer sees is decided automatically by which products are enabled on their account (`hasProduct` — no manual configuration needed).

**Authority** (asked once)
- Does a named senior leader own experience management as part of their actual role?
- Is experience performance reviewed at leadership level, on a regular schedule?
- Are there formal objectives tied to experience outcomes?

**Net Value** (asked once)
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

**Renewal** (asked once)
- When the same problem comes up repeatedly, does it typically trigger a structural change (new training, new process), or does each instance just get handled individually?

**Length:** a single-product customer answers ~28–32 questions total (the shared ~12, plus one flavor of Hearing/Ownership). A dual-product customer answers both flavors of Hearing and Ownership, landing ~36–40. Describe the length as "25–40 questions," not a fixed number — it scales with which products the account actually uses.

### Sub-phases

- **7a** — data model + the gate-based scoring engine, backend only, fully testable before any screen exists. **Blocked until REACH and the gate-scoring mechanics are defined** (Phase 0).
- **7b** — the assessment-taking flow (the ladder-question UI)
- **7c** — the results page (Established/Emerging stage, ANCHOR bands, evidence text)
- **7d** — the recommendation engine + deep links into the rest of the product (e.g. "Set up Category Owners →," "Configure Escalation Rules →" — these must point at features already in their final shape, which is why Compass is sequenced after CSAT/CES and Attention Centre)

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
