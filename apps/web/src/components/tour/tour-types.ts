// The merged runtime shape CoachMark actually renders — structural wiring
// (target/placement, from tour-definitions.ts) zipped with fetched text
// content (title/body, from /api/tours/[tourId]) by matching `key`.
export interface TourStep {
  key: string;
  target: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
}

export interface TourDefinition {
  id: string;
  label: string;
  steps: TourStep[];
}
