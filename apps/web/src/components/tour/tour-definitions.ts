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
};
