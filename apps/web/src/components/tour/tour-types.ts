export interface TourStep {
  // Matches an element rendered with data-tour="<target>" somewhere on the
  // current page. If the element isn't found (e.g. conditional content
  // hasn't loaded yet), the step is skipped automatically rather than
  // stalling the tour on a spotlight with nothing to point at.
  target: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
}

export interface TourDefinition {
  id: string;
  label: string; // shown on the "Take a tour" trigger, e.g. "Take a tour of this page"
  steps: TourStep[];
}
