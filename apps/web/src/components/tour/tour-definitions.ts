import type { TourDefinition } from "./tour-types";

// Content is rolled out in priority order rather than all at once (Business
// has ~9 pages, Group ~16 — writing genuinely useful, screen-specific copy
// for all of them in one pass would be rushed). Starting with the screen
// every user sees first; Command Center, Case Management, and Decision Log
// are next, added as their own entries here when ready — the engine above
// doesn't change, only this list grows.
export const TOUR_DEFINITIONS: Record<string, TourDefinition> = {
  "business-dashboard": {
    id: "business-dashboard",
    label: "Take a tour of your Dashboard",
    steps: [
      {
        target: "dash-kpi-strip",
        title: "Your headline numbers",
        body: "Total responses, average score, NPS, and conversion rate — the four numbers that answer \"how are we doing\" at a glance. These update as new feedback comes in.",
        placement: "bottom",
      },
      {
        target: "dash-comparisons",
        title: "This period vs. last",
        body: "See whether you're trending up or down over the last week, month, quarter, and year — not just where you stand today.",
        placement: "bottom",
      },
      {
        target: "dash-trend",
        title: "Response trend",
        body: "Your daily average score over time. A sudden dip here is usually the first sign something's worth investigating.",
        placement: "right",
      },
      {
        target: "dash-distribution",
        title: "Rating distribution",
        body: "How your ratings break down — mostly high scores with a long tail of 1–2 stars looks very different from a cluster in the middle, even at the same average.",
        placement: "left",
      },
      {
        target: "dash-comments",
        title: "Latest comments",
        body: "The actual words behind the numbers — the most recent written feedback, newest first.",
        placement: "top",
      },
    ],
  },
  "group-overview": {
    id: "group-overview",
    label: "Take a tour of your Overview",
    steps: [
      {
        target: "group-kpi-strip",
        title: "Your organisation at a glance",
        body: "Headline numbers rolled up across every branch in your organisation.",
        placement: "bottom",
      },
      {
        target: "group-branches-table",
        title: "Branch performance",
        body: "Every branch side by side, so you can spot who's leading and who needs attention without opening each one individually.",
        placement: "top",
      },
    ],
  },
};
