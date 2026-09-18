"use client";

import { useEffect } from "react";
import { useTour } from "./tour-provider";

/**
 * Drop into a page that has a registered tour — auto-launches it the first
 * time this user ever lands here (seenTours doesn't include this tour id
 * yet), then never again on its own. Deliberately a no-op re-render: it
 * only calls startTour once per mount, so navigating away and back within
 * the same session doesn't re-trigger it after a Skip/Done already marked
 * it seen client-side.
 */
export function TourAutostart({ tourId }: { tourId: string }) {
  const { isSeen, startTour } = useTour();

  useEffect(() => {
    if (!isSeen(tourId)) startTour(tourId);
    // Intentionally only on mount — isSeen/startTour identity changes as
    // seenTours updates shouldn't re-fire this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId]);

  return null;
}
