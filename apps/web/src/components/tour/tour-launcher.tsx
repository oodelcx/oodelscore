"use client";

import { useTour } from "./tour-provider";

/**
 * The single "show me around" affordance — one persistent button, always
 * in the same spot, that always launches (or replays) whatever tour is
 * registered for the CURRENT screen (via TourProvider's route lookup).
 * Mounted once per portal shell, not per page, so clicking it while on
 * Case Management can never accidentally jump to a different screen's
 * tour. Renders nothing on a screen with no registered tour.
 */
export function TourLauncher() {
  const { currentTourId, startTour } = useTour();
  if (!currentTourId) return null;

  return (
    <button
      type="button"
      onClick={() => startTour(currentTourId)}
      title="Take a tour of this screen"
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
