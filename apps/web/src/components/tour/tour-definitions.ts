export interface StructuralStep {
  // Stable id matched against the text content fetched from
  // /api/tours/[tourId] (packages/shared TourScreen / SEED_TOURS) — this
  // file owns the DOM wiring and step order, that content owns the words.
  key: string;
  // Matches an element rendered with data-tour="<target>" on the current
  // page. If it isn't found, the step auto-skips instead of spotlighting
  // nothing (see coach-mark.tsx).
  target: string;
  placement?: "top" | "bottom" | "left" | "right";
}

export interface StructuralTour {
  id: string;
  steps: StructuralStep[];
}

export const TOUR_DEFINITIONS: Record<string, StructuralTour> = {
  "business-dashboard": {
    id: "business-dashboard",
    steps: [
      { key: "kpi-strip", target: "dash-kpi-strip", placement: "bottom" },
      { key: "comparisons", target: "dash-comparisons", placement: "bottom" },
      { key: "trend", target: "dash-trend", placement: "right" },
      { key: "distribution", target: "dash-distribution", placement: "left" },
      { key: "comments", target: "dash-comments", placement: "top" },
    ],
  },
  "group-overview": {
    id: "group-overview",
    steps: [
      { key: "kpi-strip", target: "group-kpi-strip", placement: "bottom" },
      { key: "branches-table", target: "group-branches-table", placement: "top" },
    ],
  },
  "business-cases": {
    id: "business-cases",
    steps: [
      { key: "kpi-strip", target: "cases-kpi-strip", placement: "bottom" },
      { key: "new-case", target: "cases-new-button", placement: "left" },
      { key: "filters", target: "cases-filters", placement: "bottom" },
      { key: "first-case", target: "cases-first-card", placement: "top" },
      { key: "case-playbook", target: "cases-first-playbook", placement: "top" },
      { key: "case-resolve", target: "cases-first-resolve", placement: "left" },
    ],
  },
  "group-cases": {
    id: "group-cases",
    steps: [
      { key: "kpi-strip", target: "cases-kpi-strip", placement: "bottom" },
      { key: "filters", target: "cases-filters", placement: "bottom" },
      { key: "first-case", target: "cases-first-card", placement: "top" },
      { key: "case-escalate", target: "cases-first-escalate", placement: "left" },
    ],
  },
  "business-feedback-points": {
    id: "business-feedback-points",
    steps: [
      { key: "request", target: "fp-request-button", placement: "left" },
      { key: "first-point", target: "fp-first-card", placement: "top" },
      { key: "view-qr", target: "fp-first-qr", placement: "top" },
    ],
  },
  "business-category-owners": {
    id: "business-category-owners",
    steps: [
      { key: "table", target: "cat-owners-table", placement: "top" },
      { key: "first-select", target: "cat-owners-first-select", placement: "left" },
    ],
  },
  "group-category-owners": {
    id: "group-category-owners",
    steps: [
      { key: "table", target: "cat-owners-table", placement: "top" },
      { key: "first-select", target: "cat-owners-first-select", placement: "left" },
    ],
  },
  "business-alert-rules": {
    id: "business-alert-rules",
    steps: [
      { key: "new-rule", target: "alert-new-rule", placement: "bottom" },
      { key: "rules-table", target: "alert-rules-table", placement: "top" },
    ],
  },
  "group-alert-rules": {
    id: "group-alert-rules",
    steps: [
      { key: "new-rule", target: "alert-new-rule", placement: "bottom" },
      { key: "rules-table", target: "alert-rules-table", placement: "top" },
    ],
  },
  "business-playbooks": {
    id: "business-playbooks",
    steps: [
      { key: "new-playbook", target: "pb-new-playbook", placement: "bottom" },
      { key: "first-playbook", target: "pb-first-card", placement: "top" },
    ],
  },
  "group-playbooks": {
    id: "group-playbooks",
    steps: [
      { key: "new-playbook", target: "pb-new-playbook", placement: "bottom" },
      { key: "first-playbook", target: "pb-first-card", placement: "top" },
    ],
  },
  "business-decision-log": {
    id: "business-decision-log",
    steps: [
      { key: "new-button", target: "dl-new-button", placement: "left" },
      { key: "first-entry", target: "dl-first-card", placement: "top" },
    ],
  },
  "group-decision-log": {
    id: "group-decision-log",
    steps: [
      { key: "new-button", target: "dl-new-button", placement: "left" },
      { key: "first-entry", target: "dl-first-card", placement: "top" },
    ],
  },
  "business-raw-feedback": {
    id: "business-raw-feedback",
    steps: [
      { key: "filters", target: "rf-filters", placement: "bottom" },
      { key: "first-response", target: "rf-first-card", placement: "top" },
      { key: "log-action", target: "rf-first-log-action", placement: "top" },
    ],
  },
};

// Which tour a route auto-launches / replays via the single "Take a tour"
// trigger. A route with no entry here simply shows no trigger — most
// deliberately so on read-only screens (Insights, Analytics, Compare,
// Command Center, ...), which don't get a tour at all.
export const ROUTE_TOUR_MAP: Record<string, string> = {
  "/business": "business-dashboard",
  "/group": "group-overview",
  "/business/cases": "business-cases",
  "/group/cases": "group-cases",
  "/business/feedback-points": "business-feedback-points",
  "/business/category-owners": "business-category-owners",
  "/group/category-owners": "group-category-owners",
  "/business/alert-rules": "business-alert-rules",
  "/group/alert-rules": "group-alert-rules",
  "/business/playbooks": "business-playbooks",
  "/group/playbooks": "group-playbooks",
  "/business/decision-log": "business-decision-log",
  "/group/decision-log": "group-decision-log",
  "/business/responses": "business-raw-feedback",
};
