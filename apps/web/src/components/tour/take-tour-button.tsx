"use client";

import { useTour } from "./tour-provider";
import { TOUR_DEFINITIONS } from "./tour-definitions";

/**
 * The "Show me around" affordance — a small ? floating bottom-right on any
 * page that has a registered tour, so someone can deliberately re-trigger
 * it later instead of only ever seeing it once on first login. Always
 * starts the tour regardless of seen state.
 */
export function TakeTourButton({ tourId }: { tourId: string }) {
  const { startTour } = useTour();
  const definition = TOUR_DEFINITIONS[tourId];
  if (!definition) return null;

  return (
    <button
      type="button"
      onClick={() => startTour(tourId)}
      title={definition.label}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "none",
        background: "#15181b",
        color: "#3fbe8b",
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        zIndex: 400,
      }}
    >
      ?
    </button>
  );
}
