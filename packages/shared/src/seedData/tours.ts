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
  {
    tourId: "business-feedback-points",
    tourLabel: "Take a tour of Feedback Points",
    steps: [
      {
        key: "request",
        title: "Requesting a feedback point",
        body: "New QR points and question changes go through your account manager, so every survey stays error-free — send a note about what you need and they'll action it, usually within a business day.",
      },
      {
        key: "first-point",
        title: "A feedback point, up close",
        body: "Scans, responses, and conversion rate for this point, plus which question set and layout it's currently using.",
      },
      {
        key: "view-qr",
        title: "The QR code itself",
        body: "Download or print the poster for this location straight from here.",
      },
    ],
  },
  {
    tourId: "business-category-owners",
    tourLabel: "Take a tour of Category Owners",
    steps: [
      {
        key: "table",
        title: "Who a category goes to",
        body: "When an Alert Rule fires, the AI picks the category — this table says who the resulting case is assigned to.",
      },
      {
        key: "first-select",
        title: "Setting an owner",
        body: "Pick from your team, or invite someone new on the spot if they're not in the list yet.",
      },
    ],
  },
  {
    tourId: "group-category-owners",
    tourLabel: "Take a tour of Category Owners",
    steps: [
      {
        key: "table",
        title: "The default owner for every branch",
        body: "This is the fallback for every branch in your organisation — any branch can still set its own owner for a category, which overrides your default for that branch only.",
      },
      {
        key: "first-select",
        title: "Setting a default",
        body: "Pick from your team, or invite someone new on the spot if they're not in the list yet.",
      },
    ],
  },
  {
    tourId: "business-alert-rules",
    tourLabel: "Take a tour of Alert Rules",
    steps: [
      {
        key: "new-rule",
        title: "Creating a rule",
        body: "Get notified the moment a metric slips below a threshold — set the type, the metric to watch, and who hears about it.",
      },
      {
        key: "rules-table",
        title: "Your rules",
        body: "Pause, resume, or delete a rule, and see how often it's actually fired in the last 30 days.",
      },
    ],
  },
  {
    tourId: "group-alert-rules",
    tourLabel: "Take a tour of Alert Rules",
    steps: [
      {
        key: "new-rule",
        title: "Creating an organisation-wide rule",
        body: "A rule set here cascades to every business in scope — all branches, or just one region — on top of whatever rules each branch has of its own.",
      },
      {
        key: "rules-table",
        title: "Your organisation rules",
        body: "This is what produces the \"Flagged\" counts you see on Overview — pause, resume, or delete a rule from here.",
      },
    ],
  },
  {
    tourId: "business-playbooks",
    tourLabel: "Take a tour of the Playbook Library",
    steps: [
      {
        key: "new-playbook",
        title: "Writing a playbook",
        body: "Standard step-by-step guidance for a category or issue type — it shows up automatically on any matching case in Case Management.",
      },
      {
        key: "first-playbook",
        title: "A playbook, up close",
        body: "See how often it's actually used, its completion rate, and open its steps to edit them.",
      },
    ],
  },
  {
    tourId: "group-playbooks",
    tourLabel: "Take a tour of the Playbook Library",
    steps: [
      {
        key: "new-playbook",
        title: "Writing a playbook for your branches",
        body: "A playbook authored here attaches automatically to a matching case at any branch that doesn't already have its own — branches check off the steps on their own cases, and you see their progress live.",
      },
      {
        key: "first-playbook",
        title: "A playbook, up close",
        body: "Usage and completion rate across every branch it applies to, plus its steps.",
      },
    ],
  },
  {
    tourId: "business-decision-log",
    tourLabel: "Take a tour of the Decision Log",
    steps: [
      {
        key: "new-button",
        title: "Logging a decision",
        body: "Resolving a case with a note in Case Management logs one here automatically — this is for anything else worth recording deliberately.",
      },
      {
        key: "first-entry",
        title: "A decision, up close",
        body: "Track its status, then measure the outcome once it's been implemented for a while — did the number actually move?",
      },
    ],
  },
  {
    tourId: "group-decision-log",
    tourLabel: "Take a tour of the Decision Log",
    steps: [
      {
        key: "new-button",
        title: "Logging an organisation-wide decision",
        body: "For changes that affect more than one branch — link the businesses it touches so its measured outcome rolls up correctly.",
      },
      {
        key: "first-entry",
        title: "A decision, up close",
        body: "Track its status, then measure the outcome once it's been implemented for a while — did the number actually move?",
      },
    ],
  },
  {
    tourId: "business-raw-feedback",
    tourLabel: "Take a tour of Raw Feedback",
    steps: [
      {
        key: "filters",
        title: "Finding what matters",
        body: "Narrow to negative ratings, responses with a comment, or one specific feedback point.",
      },
      {
        key: "first-response",
        title: "A response, up close",
        body: "The rating, the comment, and who left it (when they chose to share that).",
      },
      {
        key: "log-action",
        title: "Acting on it",
        body: "Flag anything worth a second look, or log an action taken directly from here — it creates a case in Case Management without you having to switch screens.",
      },
    ],
  },
];
