# Product roadmap — post-launch feature phases

This is the phased plan agreed with the product owner for everything built on top of the initial migration (which followed the spec's own Section 14 build order). It exists so the plan survives context resets across sessions — **read this before starting or resuming any phase below**, and update the status table as work lands.

Each phase ships the same way: a feature branch off `main`, `npm run typecheck` and `npm run build` verified clean before every push, a PR opened and merged into `main` — never straight to `production`. Merging `main` → `production` is a separate, always-confirmed-first step once a phase is reviewed and approved on `main`.

## Status

| Phase | Name | Status |
|---|---|---|
| 0 | Lock the ANCHOR/REACH naming (Compass) | **Not started** |
| 1 | CSAT/CES + honest before/after | Done |
| 2 | Attention Centre | Done |
| 3 | De-escalation | Done |
| 4 | Closing the loop (CX + EX halves) | Done |
| 5 | Business Value / £/$ module | Done |
| 6 | Business-side survey builder | **Not started** — needs explicit go-ahead (loosens an Admin-only permission rule) |
| 7 | OodelCX Compass (7a–7d) | **Not started** |
| 8 | Everything marked "later" | **Not started** |

A QA fix batch (question text in case trail, escalation UX clarity, Closing the Loop redesign, Attention Centre redesign, heavier seed data) landed on top of Phases 1–5 as PR #182, merged into `main`.

## Phase 0 — Before any code: lock the naming

The ANCHOR/REACH names and the gate-based scoring mechanism need to be finalized (and cleared of any lingering Qualtrics-overlap risk) before they get baked into a database schema, UI copy, and marketing pages. Renaming five words on paper is free; renaming them after they're wired through code and shown to customers is not. **This blocks Phase 7, nothing else** — everything before that can proceed in parallel.

## Phase 1 — CSAT/CES + honest before/after (small, foundational, no new data model) — DONE

Both are fixes to what already exists, not new features — lowest risk, fastest to ship, and they de-risk everything measurement-related that comes after:

- Add CES as a 10th question type, with its own (inverted) scoring
- Formally label and report CSAT alongside NPS
- Surface NPS/CSAT/CES together on Analytics, Command Center, CX Pulse
- Decision Log: add the confidence label + sample-size warning + driver-specific check from the mockup

Nothing else in the plan depends on this being done first, but it's small, valuable on its own, and worth clearing before building things that display scores (Attention Centre, Compass results) so they inherit the fixed metrics rather than needing a second pass later.

## Phase 2 — Attention Centre (medium, high leverage, no new data sources) — DONE

Deliberately early because it needs no new data collection at all, only a UI layer and sorting logic on top of Cases, Alerts, Playbook Runs, and Decision Log, all of which already exist. Best ratio of visible impact to build risk in the whole list, and it becomes the foundation Ask OodelCX and 1BYTE both sit on later (per the "one engine, three formats" decision), so building it now means those later phases are mostly presentation work, not new logic.

## Phase 3 — De-escalation (small, isolated) — DONE

A contained addition to the existing Escalation Workflow — append-only event log, a reason field, a computed "current level." Doesn't touch or depend on anything else in this list.

## Phase 4 — Closing the loop (medium, two independent halves) — DONE

- **CX half:** a consent checkbox + contact field on the feedback form, plus a small "recent improvements" notice board.
- **EX half:** an anonymous broadcast composer for the business, scoped to a team/branch, never an individual.

Both self-contained; built as separate PRs rather than one big one.

## Phase 5 — Business Value / £/$ module (medium) — DONE

Sequenced after Decision Log's confidence tweak (Phase 1) because a £/$ claim should only ever be shown attached to a before/after result the system already trusts — building the money layer before the trust layer would let it make confident-sounding financial claims off shaky data. Needs: the standard-fields settings screen, and a calculation step that runs whenever a Decision Log entry gets its "after" measurement.

## Phase 6 — Business-side survey builder (medium, touches a permission rule directly) — NOT STARTED

Gets its own isolated phase on purpose: it means deliberately loosening a rule that's currently written into this project's own working agreement as hard and server-enforced ("survey/question configuration are Admin-only... reject writes... even if present in the request body" — see CLAUDE.md's Working agreement). That's not a casual change — it needs its own careful review, not to be bundled into a bigger PR where it could slip through less scrutinized.

## Phase 7 — OodelCX Compass (large — the biggest single body of work here) — NOT STARTED

Sub-phased on its own:

- **7a** — data model + the gate-based scoring engine, backend only, fully testable before any screen exists
- **7b** — the assessment-taking flow (the ladder-question UI)
- **7c** — the results page (Established/Emerging stage, ANCHOR bands, evidence text)
- **7d** — the recommendation engine + deep links into the rest of the product

Placed after everything above because Compass's recommendations are supposed to link into real features ("Set up Category Owners →," "Configure Escalation Rules →") — building it before those exist properly, or before CSAT/CES and the honest-before/after fixes land, means its own recommendations would be pointing at things not yet in their final shape. **Blocked on Phase 0** (naming must be locked first).

## Phase 8 — Everything marked "later" (lowest priority, each has its own blocker) — NOT STARTED

- **Ask OodelCX** — waits on Attention Centre (Phase 2, done) for its underlying engine
- **1BYTE** — same dependency, plus needs an actual TTS vendor decision (external cost, not just build time)
- **Agent Queue** — needs enough of the above built that there's something real to suggest, plus the human-approval UI
- **Evidence fusion** — explicitly needs Compass (Phase 7) live with real historical answers to compare against, can't exist before it
- **External Feedback, Integrations** — no blocker, just genuinely lower priority than everything above
