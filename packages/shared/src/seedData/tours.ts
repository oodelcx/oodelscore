interface SeedTourStep {
  key: string;
  title: string;
  body: string;
}
interface SeedTour {
  tourId: string;
  tourLabel: string;
  steps: SeedTourStep[];
}

// Starting copy for the guided-tour engine — final wording is edited from
// Admin -> Guided Tours, not here. Each step's `key` must match the `key`
// in the matching structural definition
// (apps/web/src/components/tour/tour-definitions.ts), which owns which DOM
// element the step points at and in what order — this file only owns the
// words, same split as SEED_TOOLTIPS/SEED_EMAIL_TEMPLATES.
export const SEED_TOURS: SeedTour[] = [
  {
    tourId: "business-dashboard",
    tourLabel: "Take a tour of your Dashboard",
    steps: [
      {
        key: "kpi-strip",
        title: "Your headline numbers",
        body: "Total responses, average score, NPS, and conversion rate — the four numbers that answer \"how are we doing\" at a glance. These update as new feedback comes in.",
      },
      {
        key: "comparisons",
        title: "This period vs. last",
        body: "See whether you're trending up or down over the last week, month, quarter, and year — not just where you stand today.",
      },
      {
        key: "trend",
        title: "Response trend",
        body: "Your daily average score over time. A sudden dip here is usually the first sign something's worth investigating.",
      },
      {
        key: "distribution",
        title: "Rating distribution",
        body: "How your ratings break down — mostly high scores with a long tail of 1–2 stars looks very different from a cluster in the middle, even at the same average.",
      },
      {
        key: "comments",
        title: "Latest comments",
        body: "The actual words behind the numbers — the most recent written feedback, newest first.",
      },
    ],
  },
  {
    tourId: "group-overview",
    tourLabel: "Take a tour of your Overview",
    steps: [
      {
        key: "kpi-strip",
        title: "Your organisation at a glance",
        body: "Headline numbers rolled up across every branch in your organisation.",
      },
      {
        key: "branches-table",
        title: "Branch performance",
        body: "Every branch side by side, so you can spot who's leading and who needs attention without opening each one individually.",
      },
    ],
  },
  {
    tourId: "business-cases",
    tourLabel: "Take a tour of Case Management",
    steps: [
      {
        key: "kpi-strip",
        title: "How your caseload looks right now",
        body: "Open, in progress, overdue, and resolved — the health of your queue at a glance before you dive into individual cases.",
      },
      {
        key: "new-case",
        title: "Log a case yourself",
        body: "Most cases are created automatically when an Alert Rule fires on flagged feedback, but you can log one manually here too — for anything worth tracking that didn't trip a rule.",
      },
      {
        key: "filters",
        title: "Filter your queue",
        body: "Jump straight to what's unassigned, overdue, or already resolved, or narrow to one category.",
      },
      {
        key: "first-case",
        title: "A case, up close",
        body: "Title, category, priority, and due date at a glance. Cases from a rated response show the star rating too.",
      },
      {
        key: "case-playbook",
        title: "Playbook steps",
        body: "When a matching Playbook exists, its checklist attaches automatically — click here to work through the steps and track progress as you go.",
      },
      {
        key: "case-resolve",
        title: "Resolving a case",
        body: "Mark it resolved with a note on what you did — that note is what becomes your Decision Log entry, no separate step needed.",
      },
    ],
  },
  {
    tourId: "group-cases",
    tourLabel: "Take a tour of Case Management",
    steps: [
      {
        key: "kpi-strip",
        title: "Oversight across every branch",
        body: "Every branch's cases roll up here — open, overdue, and escalated — so you can see where attention is needed without opening each branch individually.",
      },
      {
        key: "filters",
        title: "Filter across branches",
        body: "Narrow down to unassigned, overdue, or escalated cases across your whole organisation.",
      },
      {
        key: "first-case",
        title: "A branch's case, up close",
        body: "You're read-only here by design — assigning and resolving is each branch's own job. You can comment, or flag it escalated if it needs your attention.",
      },
      {
        key: "case-escalate",
        title: "Flagging a case",
        body: "Escalating notifies the branch (or a branch can escalate one up to you) — either way, it's a signal to look closer, not a takeover of their case.",
      },
    ],
  },
];
