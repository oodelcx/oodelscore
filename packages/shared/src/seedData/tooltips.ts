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
  {
    screenKey: "group-overview",
    screenLabel: "Group Overview",
    tooltips: [
      {
        key: "network-average",
        label: "Network average",
        text: "Average star rating (1–5) across every branch in your organization, for the current period.",
      },
      {
        key: "network-nps",
        label: "Network NPS",
        text: "Net Promoter Score across your whole network — Promoters (9–10) minus Detractors (0–6), as a percentage of all respondents.",
      },
      {
        key: "cx-pulse-level",
        label: "CX Pulse",
        text: "How well your organization turns feedback into action, on a 5-level maturity scale — not just how happy customers are, but whether issues actually get fixed.",
      },
      {
        key: "needs-attention",
        label: "Needs attention",
        text: "Branches scoring meaningfully below their own region's average (measured in standard deviations), so real outliers surface even on a large network.",
      },
      {
        key: "region-confidence",
        label: "Low sample",
        text: "A region's average is flagged \"low sample\" when it doesn't yet have enough responses to be a reliable signal — treat it as directional, not final.",
      },
    ],
  },
  {
    screenKey: "group-branches",
    screenLabel: "Group Branches",
    tooltips: [
      {
        key: "billed-to",
        label: "Billed to",
        text: "Whether this branch's subscription is paid by the parent group (rolled into one consolidated invoice) or billed to the branch itself. Set by your OodelCX account manager, not editable here.",
      },
    ],
  },
  {
    screenKey: "group-compare",
    screenLabel: "Group Compare Branches",
    tooltips: [
      {
        key: "category-gap",
        label: "By category",
        text: "Category averages side by side for the branches you've selected — this is where the real performance gaps show up, even when overall averages look similar.",
      },
      {
        key: "cx-pulse-level",
        label: "CX Pulse",
        text: "Each branch's CX Pulse maturity level — how well that branch turns feedback into action, not just its star rating.",
      },
    ],
  },
  {
    screenKey: "group-insights",
    screenLabel: "Group Insights",
    tooltips: [
      {
        key: "ai-report",
        label: "Insights",
        text: "AI-generated, plain-English summaries of your network's feedback for the period — reviewed by the OodelCX team before publishing.",
      },
    ],
  },
  {
    screenKey: "group-analytics",
    screenLabel: "Group Analytics",
    tooltips: [
      {
        key: "nps-breakdown",
        label: "NPS breakdown",
        text: "How your network's respondents split into Promoters (9–10), Passives (7–8), and Detractors (0–6) — the raw counts behind your NPS score.",
      },
      {
        key: "comment-themes",
        label: "Comment themes",
        text: "The most frequently mentioned words and phrases pulled from open-ended answers across your network, sized by how often they come up.",
      },
      {
        key: "driver-analysis",
        label: "Driver Analysis",
        text: "How strongly each feedback category correlates with a response's overall rating. Priority categories score below average and move the needle most on overall score — fix these first.",
      },
      {
        key: "root-cause",
        label: "Root Cause",
        text: "An AI-generated read of why a priority category is scoring low, built from the actual comments and ratings behind it — not a guess. Confidence is labeled Likely, Inferred, or Uncertain based on how much evidence supports it.",
      },
      {
        key: "theme-intelligence",
        label: "Theme & Sentiment Intelligence",
        text: "What customers are actually talking about, extracted from open-ended answers by AI and grouped by topic, with a positive/neutral/negative sentiment split for each.",
      },
    ],
  },
  {
    screenKey: "business-analytics",
    screenLabel: "Business Analytics",
    tooltips: [
      {
        key: "nps-breakdown",
        label: "NPS breakdown",
        text: "How your respondents split into Promoters (9–10), Passives (7–8), and Detractors (0–6) — the raw counts behind your NPS score.",
      },
      {
        key: "comment-themes",
        label: "Comment themes",
        text: "The most frequently mentioned words and phrases pulled from open-ended answers, sized by how often they come up. Red highlights lean negative.",
      },
      {
        key: "driver-analysis",
        label: "Driver Analysis",
        text: "How strongly each feedback category correlates with a response's overall rating. Priority categories score below average and move the needle most on overall score — fix these first.",
      },
      {
        key: "root-cause",
        label: "Root Cause",
        text: "An AI-generated read of why a priority category is scoring low, built from the actual comments and ratings behind it — not a guess. Confidence is labeled Likely, Inferred, or Uncertain based on how much evidence supports it.",
      },
      {
        key: "theme-intelligence",
        label: "Theme & Sentiment Intelligence",
        text: "What customers are actually talking about, extracted from open-ended answers by AI and grouped by topic, with a positive/neutral/negative sentiment split for each.",
      },
      {
        key: "demographics",
        label: "Respondent age & gender",
        text: "Age and gender are only shown for respondents who chose to share them — this is never required to submit feedback.",
      },
      {
        key: "scan-heatmap",
        label: "When feedback is submitted",
        text: "Day-of-week × hour breakdown of when responses come in — darker cells mean more responses, useful for spotting when to prompt customers for feedback.",
      },
    ],
  },
  {
    screenKey: "group-raw-feedback",
    screenLabel: "Group Raw Feedback",
    tooltips: [
      {
        key: "negative-only",
        label: "Negative only",
        text: "Shows only responses with a star rating of 2 or below, across every branch.",
      },
      {
        key: "flagged",
        label: "Flagged",
        text: "This response was flagged for follow-up by the branch — usually because it needs a closer look or a direct response.",
      },
    ],
  },
  {
    screenKey: "group-alert-rules",
    screenLabel: "Group Alert Rules",
    tooltips: [
      {
        key: "regional-outlier",
        label: "Sensitivity",
        text: "How many standard deviations below the group average a branch has to fall before this rule fires — lower numbers fire more easily, higher numbers only catch the most extreme outliers.",
      },
      {
        key: "sudden-drop",
        label: "Sudden drop",
        text: "Fires when a branch's score falls by this percentage compared to its own baseline average over the window below — catches sharp declines that a fixed threshold would miss.",
      },
      {
        key: "recipients",
        label: "Recipients",
        text: "Who gets emailed when this rule fires. Add multiple people by separating their emails with commas.",
      },
      {
        key: "org-rules",
        label: "Organization rules",
        text: "Rules created here apply across every business in scope (all branches, or one region) and cascade down automatically — no need to set them up per branch.",
      },
      {
        key: "business-rules-oversight",
        label: "Business rules",
        text: "Alert rules each individual branch has set up for itself. Shown here for visibility only — branches manage their own rules from their own Alert Rules page.",
      },
    ],
  },
  {
    screenKey: "business-alert-rules",
    screenLabel: "Business Alert Rules",
    tooltips: [
      {
        key: "threshold",
        label: "Threshold",
        text: "The value that triggers this alert — for a fixed threshold, fires when the metric falls below this number; for an NPS floor, fires when NPS drops below it.",
      },
      {
        key: "recipients",
        label: "Recipients",
        text: "Who gets emailed when this rule fires. Add multiple people by separating their emails with commas.",
      },
      {
        key: "inherited-rules",
        label: "Inherited rules",
        text: "Alert rules set by your parent organization that apply to your branch automatically. They're read-only here — ask your organization admin to change them.",
      },
    ],
  },
  {
    screenKey: "group-action-board",
    screenLabel: "Group Action Board",
    tooltips: [
      {
        key: "oversight",
        label: "Action Board",
        text: "Read-only oversight of every branch's Action Board — assigning and resolving items is each branch's own job. You can comment on an item or mark it Escalated if it needs your attention.",
      },
      {
        key: "due-date",
        label: "Overdue",
        text: "Items that have passed their due date without being resolved.",
      },
      {
        key: "escalated",
        label: "Escalated",
        text: "A branch (or you) flagged this item as needing the parent organization's attention — hover the pill for the note explaining why.",
      },
      {
        key: "owner",
        label: "Owner",
        text: "Who at the branch is responsible for resolving this item.",
      },
    ],
  },
  {
    screenKey: "group-decision-log",
    screenLabel: "Group Decision Log",
    tooltips: [
      {
        key: "decision-log",
        label: "Decision Log",
        text: "A record of decisions made in response to feedback, with a before/after measurement of whether they actually worked. Resolving an Action Board item with a note logs one here automatically.",
      },
      {
        key: "trigger",
        label: "Trigger",
        text: "The feedback pattern that prompted this decision — what you saw in the data that made this worth doing.",
      },
      {
        key: "outcome-measurement",
        label: "Outcome",
        text: "OodelCX compares the average metric across everyone who responded in the 30 days before implementation to everyone who's responded since, using real feedback data — not a survey about the decision itself. Needs at least 14 days since implementation to measure.",
      },
    ],
  },
  {
    screenKey: "business-decision-log",
    screenLabel: "Business Decision Log",
    tooltips: [
      {
        key: "trigger",
        label: "Trigger",
        text: "The feedback pattern that prompted this decision — what you saw in the data that made this worth doing.",
      },
      {
        key: "outcome-measurement",
        label: "Metric",
        text: "OodelCX compares the average metric across everyone who responded in the 30 days before implementation to everyone who's responded since, using real feedback data. Needs at least 14 days since implementation to measure.",
      },
    ],
  },
  {
    screenKey: "group-playbooks",
    screenLabel: "Group Playbooks",
    tooltips: [
      {
        key: "playbooks",
        label: "Playbooks",
        text: "Pre-written response steps for a recurring feedback pattern, so branches don't have to figure out what to do from scratch every time a category starts trending down.",
      },
      {
        key: "auto-trigger",
        label: "Auto-check trigger",
        text: "Optionally have OodelCX automatically check this playbook's condition against real data (a category average crossing a threshold, or a burst of negative mentions) instead of relying on someone to notice and open it manually.",
      },
    ],
  },
  {
    screenKey: "business-playbooks",
    screenLabel: "Business Playbooks",
    tooltips: [
      {
        key: "playbooks",
        label: "Playbooks",
        text: "Pre-written response steps for a recurring feedback pattern, so you don't have to figure out what to do from scratch every time a category starts trending down.",
      },
      {
        key: "auto-trigger",
        label: "Auto-check trigger",
        text: "Optionally have OodelCX automatically check this playbook's condition against real data (a category average crossing a threshold, or a burst of negative mentions) instead of relying on someone to notice and open it manually.",
      },
    ],
  },
  {
    screenKey: "group-maturity",
    screenLabel: "Group CX Pulse",
    tooltips: [
      {
        key: "cx-pulse-composite",
        label: "CX Pulse Score",
        text: "CX Pulse measures how well your organization turns feedback into action — not just how happy customers are, but whether the team is actually responding, fixing issues, and improving over time. Scored out of 100, mapped to 5 maturity levels.",
      },
      {
        key: "dimensions",
        label: "Dimensions",
        text: "CX Pulse is built from five dimensions: Awareness (is feedback being collected and seen), Response (is it acted on quickly), Ownership (are actions assigned to a named person), Culture (is feedback part of how decisions get made), and Outcome (do actions measurably move the score).",
      },
      {
        key: "checklist",
        label: "Next level",
        text: "The specific, unmet conditions standing between your organization and the next CX Pulse maturity level.",
      },
    ],
  },
  {
    screenKey: "business-cx-pulse",
    screenLabel: "Business CX Pulse",
    tooltips: [
      {
        key: "cx-pulse-composite",
        label: "CX Pulse Score",
        text: "CX Pulse measures how well your branch turns feedback into action — not just how happy customers are, but whether you're actually responding, fixing issues, and improving over time. Scored out of 100, mapped to 5 maturity levels.",
      },
      {
        key: "dimensions",
        label: "Dimensions",
        text: "CX Pulse is built from five dimensions: Awareness (is feedback being collected and seen), Response (is it acted on quickly), Ownership (are actions assigned to a named person), Culture (is feedback part of how decisions get made), and Outcome (do actions measurably move the score).",
      },
    ],
  },
  {
    screenKey: "group-billing",
    screenLabel: "Group Billing",
    tooltips: [
      {
        key: "billing-assignment",
        label: "Billed to group",
        text: "Branches on \"Group pays\" roll into your single consolidated invoice below. Which model each branch is on is set by your OodelCX account manager, not editable here.",
      },
      {
        key: "overdue-self-billed",
        label: "Overdue (self-billed)",
        text: "Branches on \"Branch pays\" with a failed or unpaid invoice of their own. Visible to you for oversight, but not payable from here — each branch manages its own payment method.",
      },
    ],
  },
  {
    screenKey: "business-billing",
    screenLabel: "Business Billing",
    tooltips: [
      {
        key: "usage",
        label: "Usage this cycle",
        text: "How many of your plan's feedback points you're using, and how many responses you've collected in the current billing cycle.",
      },
    ],
  },
  {
    screenKey: "business-category-owners",
    screenLabel: "Business Category Owners",
    tooltips: [
      {
        key: "category-owners",
        label: "Category Owners",
        text: "When an Alert Rule fires, the AI picks the feedback category — this sets who the resulting Action Board item is assigned to automatically, no separate confirmation step.",
      },
      {
        key: "default-owner",
        label: "Default owner",
        text: "Leave a category unset to fall back to your parent organization's default owner for it, if one exists.",
      },
    ],
  },
  {
    screenKey: "business-insights",
    screenLabel: "Business Insights",
    tooltips: [
      {
        key: "ai-report",
        label: "Insights",
        text: "AI-generated, plain-English summaries of your feedback for the period — reviewed by the OodelCX team before publishing.",
      },
    ],
  },
  {
    screenKey: "business-responses",
    screenLabel: "Business Raw Feedback",
    tooltips: [
      {
        key: "flag",
        label: "Flag",
        text: "Mark this response for follow-up — flagged responses are easy to find again later and are visible to your parent organization if you're part of a group.",
      },
      {
        key: "log-action",
        label: "Log action taken",
        text: "Create an Action Board item directly from this response, pre-filled with its comment and feedback point so you don't have to retype context.",
      },
    ],
  },
  {
    screenKey: "admin-accounts",
    screenLabel: "Admin Accounts",
    tooltips: [
      {
        key: "accounts",
        label: "Accounts",
        text: "Every business, parent organization, and staff member on the platform, plus who's allowed to see and edit what.",
      },
      {
        key: "login-status",
        label: "Login",
        text: "Whether this account's owner has an active login or is still on a pending invite. If an invite has gone stale, use Resend invite to send a fresh link — old links expire.",
      },
    ],
  },
  {
    screenKey: "admin-business-detail",
    screenLabel: "Admin Business Detail",
    tooltips: [
      {
        key: "total-responses",
        label: "Total responses",
        text: "Number of feedback responses this business has received, in the selected period.",
      },
      {
        key: "average-score",
        label: "Average score",
        text: "Average star rating (1–5) across all of this business's responses in the selected period.",
      },
      {
        key: "nps",
        label: "NPS",
        text: "Net Promoter Score for this business, from -100 to 100 — Promoters (9–10) minus Detractors (0–6), as a percentage of all respondents.",
      },
      {
        key: "cx-pulse-level",
        label: "CX Pulse",
        text: "This business's CX Pulse maturity level — how well it turns feedback into action, not just how happy its customers are.",
      },
      {
        key: "overdue-actions",
        label: "Overdue action items",
        text: "This business's Action Board items that have passed their due date without being resolved.",
      },
      {
        key: "response-trend",
        label: "Response trend",
        text: "Daily average score over time — use it to spot whether this business is improving or slipping.",
      },
      {
        key: "rating-distribution",
        label: "Rating distribution",
        text: "A breakdown of how many responses fell into each star rating band over the last 30 days.",
      },
    ],
  },
  {
    screenKey: "admin-parent-org-detail",
    screenLabel: "Admin Parent Org Detail",
    tooltips: [
      {
        key: "total-responses",
        label: "Total responses (network)",
        text: "Number of feedback responses received across every business under this parent organization, in the selected period.",
      },
      {
        key: "average-score",
        label: "Average score (network)",
        text: "Average star rating (1–5) across every business under this parent organization, in the selected period.",
      },
      {
        key: "nps",
        label: "NPS (network)",
        text: "Net Promoter Score across the whole network of businesses under this parent organization.",
      },
      {
        key: "cx-pulse-level",
        label: "CX Pulse",
        text: "This organization's network-wide CX Pulse maturity level — how well it turns feedback into action across all its branches.",
      },
      {
        key: "overdue-actions",
        label: "Overdue action items (network)",
        text: "Action Board items across every business in this organization that have passed their due date without being resolved.",
      },
      {
        key: "response-trend",
        label: "Response trend",
        text: "Daily average score across the whole network over time — use it to spot whether the organization is improving or slipping.",
      },
      {
        key: "rating-distribution",
        label: "Rating distribution",
        text: "A breakdown of how many responses fell into each star rating band across the network, over the last 30 days.",
      },
      {
        key: "per-branch",
        label: "Per-branch breakdown",
        text: "Every business under this parent organization, with its own score, NPS, response volume, and short-term trend — for spotting which branches need attention at a glance.",
      },
    ],
  },
];
