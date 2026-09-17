import type { ITooltipEntry } from "../models/TooltipScreen";

interface SeedTooltipScreen {
  screenKey: string;
  screenLabel: string;
  tooltips: ITooltipEntry[];
}

// Default copy for the admin-editable tooltip system. One entry per screen;
// `tooltips` is an ordered array (not a Map) since order drives the editor
// and, in future phases, could drive display order too. Final wording is
// edited from Admin -> Site CMS -> Tooltips, not here — this is only the
// fallback used until a screen has been saved through that UI (see
// apps/web/src/lib/tooltips.ts's getTooltips, mirroring getSiteContent's
// seed-fallback convention).
export const SEED_TOOLTIPS: SeedTooltipScreen[] = [
  {
    screenKey: "admin-command-center",
    screenLabel: "Admin Command Center",
    tooltips: [
      {
        key: "star-average",
        label: "Star Average",
        text: "Average star rating (1–5) across all responses in the selected period.",
      },
      {
        key: "nps",
        label: "NPS",
        text: "Net Promoter Score, from -100 to 100. Calculated from how likely customers say they'd recommend you — Promoters (9–10) minus Detractors (0–6), as a percentage of all respondents.",
      },
      {
        key: "response-count",
        label: "Response Count",
        text: "Number of feedback responses received in the last 30 days.",
      },
      {
        key: "star-delta",
        label: "Trend (WoW)",
        text: "Change in average star rating compared to the previous period. Green means improving, red means declining.",
      },
      {
        key: "health-band",
        label: "Health Band",
        text: "A quick health signal based on star rating and NPS against set thresholds — green is healthy, amber needs attention, red needs immediate action.",
      },
      {
        key: "open-actions",
        label: "Open Actions",
        text: "Number of Action Board items currently open — flagged issues with an owner assigned but not yet resolved.",
      },
      {
        key: "overdue-actions",
        label: "Overdue Actions",
        text: "Action Board items that have passed their due date without being resolved.",
      },
      {
        key: "cx-pulse-maturity",
        label: "CX Pulse Maturity",
        text: "Shows how many clients sit at each of the 5 CX Pulse maturity levels, from 1 (Collecting — just gathering feedback) to 5 (Embedded — feedback drives measured, ongoing change).",
      },
      {
        key: "portfolio-at-risk",
        label: "At Risk",
        text: "This client has been stuck at the same CX Pulse level for 3+ months with no improvement — may need extra support.",
      },
      {
        key: "portfolio-expansion-ready",
        label: "Expansion Ready",
        text: "This client shows strong, sustained engagement and could be a good fit for upsell or a case study.",
      },
      {
        key: "cx-pulse-composite",
        label: "CX Pulse Score",
        text: "CX Pulse measures how well an organization turns feedback into action — not just how happy customers are, but whether the team is actually responding, fixing issues, and improving over time. Scored out of 100, mapped to 5 maturity levels.",
      },
      {
        key: "billing-mrr",
        label: "MRR",
        text: "Total monthly recurring revenue across all paying clients.",
      },
      {
        key: "billing-comp",
        label: "Comp Accounts",
        text: "Accounts on a complimentary (non-paying) plan.",
      },
      {
        key: "billing-overdue",
        label: "Overdue Accounts",
        text: "Accounts with a failed or unpaid invoice.",
      },
      {
        key: "movers",
        label: "Movers",
        text: "Clients with the biggest change in average star rating this week — the fastest improving and fastest declining.",
      },
      {
        key: "sparkline",
        label: "Trend Line",
        text: "A quick trend of response volume over recent days — shows direction at a glance without needing exact numbers.",
      },
      {
        key: "live-feed",
        label: "Live Feed",
        text: "A real-time stream of things that need attention across the platform — fired alerts, resolved actions, new comments, logged decisions, overdue bills, and clients who've gone quiet.",
      },
    ],
  },
  {
    screenKey: "group-command-center",
    screenLabel: "Group Command Center",
    tooltips: [
      {
        key: "star-average",
        label: "Star Average",
        text: "Average star rating (1–5) across all responses in the selected period.",
      },
      {
        key: "nps",
        label: "NPS",
        text: "Net Promoter Score, from -100 to 100. Calculated from how likely customers say they'd recommend you — Promoters (9–10) minus Detractors (0–6), as a percentage of all respondents.",
      },
      {
        key: "response-count",
        label: "Response Count",
        text: "Number of feedback responses received in the last 30 days.",
      },
      {
        key: "star-delta",
        label: "Trend (WoW)",
        text: "Change in average star rating compared to the previous period. Green means improving, red means declining.",
      },
      {
        key: "health-band",
        label: "Health Band",
        text: "A quick health signal based on star rating and NPS against set thresholds — green is healthy, amber needs attention, red needs immediate action.",
      },
      {
        key: "open-actions",
        label: "Open Actions",
        text: "Number of Action Board items currently open — flagged issues with an owner assigned but not yet resolved.",
      },
      {
        key: "overdue-actions",
        label: "Overdue Actions",
        text: "Action Board items that have passed their due date without being resolved.",
      },
      {
        key: "cx-pulse-composite",
        label: "CX Pulse Score",
        text: "CX Pulse measures how well an organization turns feedback into action — not just how happy customers are, but whether the team is actually responding, fixing issues, and improving over time. Scored out of 100, mapped to 5 maturity levels.",
      },
      {
        key: "billing-mrr",
        label: "Your subscription",
        text: "What your organization pays OodelCX each month for this account — not revenue you've earned. Based on your current plan and branch count.",
      },
      {
        key: "movers",
        label: "Movers",
        text: "Clients with the biggest change in average star rating this week — the fastest improving and fastest declining.",
      },
      {
        key: "sparkline",
        label: "Trend Line",
        text: "A quick trend of response volume over recent days — shows direction at a glance without needing exact numbers.",
      },
      {
        key: "live-feed",
        label: "Live Feed",
        text: "A real-time stream of things that need attention across the platform — fired alerts, resolved actions, new comments, logged decisions, overdue bills, and clients who've gone quiet.",
      },
      {
        key: "category-matrix",
        label: "Category Matrix",
        text: "Average score for this feedback category at this branch — lower scores (redder) show where a branch is struggling most.",
      },
      {
        key: "billing-status",
        label: "Billing",
        text: "This organization's current billing status and next payment date, if applicable.",
      },
    ],
  },
  {
    screenKey: "business-dashboard",
    screenLabel: "Business Dashboard",
    tooltips: [
      {
        key: "total-responses",
        label: "Total Responses",
        text: "Number of feedback responses received in the selected period.",
      },
      {
        key: "average-score",
        label: "Average Score",
        text: "Average star rating (1–5) across all responses in the selected period.",
      },
      {
        key: "nps",
        label: "NPS",
        text: "Net Promoter Score, from -100 to 100. Calculated from how likely customers say they'd recommend you — Promoters (9–10) minus Detractors (0–6), as a percentage of all respondents.",
      },
      {
        key: "cx-pulse",
        label: "CX Pulse",
        text: "CX Pulse measures how well your team turns feedback into action — not just how happy customers are, but whether you're actually responding, fixing issues, and improving over time. Scored out of 100.",
      },
      {
        key: "conversion-rate",
        label: "Conversion Rate",
        text: "Percentage of QR code scans that turned into a completed feedback response.",
      },
      {
        key: "response-trend",
        label: "Response Trend",
        text: "How your average score has moved over time — use this to spot whether things are improving or slipping.",
      },
      {
        key: "rating-distribution",
        label: "Rating Distribution",
        text: "A breakdown of how many responses fell into each star rating, so you can see if scores are clustered high, low, or spread out.",
      },
    ],
  },
  {
    screenKey: "feedback-points",
    screenLabel: "Feedback Points",
    tooltips: [
      {
        key: "scans",
        label: "Scans",
        text: "Number of times this feedback point's QR code has been scanned.",
      },
      {
        key: "responses",
        label: "Responses",
        text: "Number of completed feedback responses from this feedback point.",
      },
      {
        key: "conversion",
        label: "Conversion",
        text: "Percentage of scans that turned into a completed response — a low number may mean the survey is too long or placed somewhere inconvenient for customers.",
      },
      {
        key: "active-status",
        label: "Active",
        text: "Whether this feedback point is currently live and collecting responses. An inactive point's QR code won't accept new submissions.",
      },
      {
        key: "request-feedback-point",
        label: "Request a Feedback Point",
        text: "New feedback points and question changes are set up by your account manager to keep every survey error-free — submit what you need here and they'll action it, usually within one business day.",
      },
    ],
  },
  {
    screenKey: "action-board",
    screenLabel: "Action Board",
    tooltips: [
      {
        key: "item-title",
        label: "Title",
        text: "A short name for the task — what needs to be done.",
      },
      {
        key: "priority",
        label: "Priority",
        text: "How urgent this item is. Higher-priority items should be tackled first.",
      },
      {
        key: "owner",
        label: "Owner",
        text: "Who's responsible for resolving this item.",
      },
      {
        key: "due-date",
        label: "Due Date",
        text: "When this item should be resolved by.",
      },
      {
        key: "status",
        label: "Status",
        text: "Where this item currently stands — e.g. open, in progress, or resolved.",
      },
      {
        key: "resolution-note",
        label: "What did you do about this?",
        text: "A short note on the fix or action taken — this becomes part of your record of what was done and why, useful later when reviewing whether it actually worked.",
      },
    ],
  },
];
