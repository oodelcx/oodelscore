"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { TOUR_DEFINITIONS } from "./tour-definitions";
import { CoachMark } from "./coach-mark";

interface TourContextValue {
  isSeen: (tourId: string) => boolean;
  // Always starts, even if already seen — this is what "Take a tour"
  // deliberately re-triggering later relies on.
  startTour: (tourId: string) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}

interface ActiveTour {
  tourId: string;
  stepIndex: number;
}

/**
 * Mounts once per portal shell (business/layout.tsx, group/layout.tsx —
 * deliberately never admin/layout.tsx, the guided-tour feature is Business
 * and Parent Org only). Owns which tour is currently playing and persists
 * "seen" state back to the account via /api/tours/seen so it doesn't nag a
 * returning user, while still letting "Take a tour" force a replay anytime.
 */
export function TourProvider({ initialSeenTours, children }: { initialSeenTours: string[]; children: ReactNode }) {
  const [seenTours, setSeenTours] = useState<Set<string>>(() => new Set(initialSeenTours));
  const [active, setActive] = useState<ActiveTour | null>(null);

  const markSeen = useCallback((tourId: string) => {
    setSeenTours((prev) => {
      if (prev.has(tourId)) return prev;
      const next = new Set(prev);
      next.add(tourId);
      return next;
    });
    fetch("/api/tours/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tourId }),
    }).catch(() => {
      // Best-effort — worst case the tour offers itself again next visit,
      // which is annoying but never blocks anything.
    });
  }, []);

  const startTour = useCallback((tourId: string) => {
    if (!TOUR_DEFINITIONS[tourId]) return;
    setActive({ tourId, stepIndex: 0 });
  }, []);

  const endTour = useCallback(
    (tourId: string) => {
      setActive(null);
      markSeen(tourId);
    },
    [markSeen]
  );

  const value = useMemo<TourContextValue>(
    () => ({
      isSeen: (tourId) => seenTours.has(tourId),
      startTour,
    }),
    [seenTours, startTour]
  );

  const activeDefinition = active ? TOUR_DEFINITIONS[active.tourId] : null;

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && activeDefinition && (
        <CoachMark
          definition={activeDefinition}
          stepIndex={active.stepIndex}
          onStepChange={(stepIndex) => setActive({ tourId: active.tourId, stepIndex })}
          onDone={() => endTour(active.tourId)}
        />
      )}
    </TourContext.Provider>
  );
}
