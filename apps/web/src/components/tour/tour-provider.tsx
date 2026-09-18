"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TOUR_DEFINITIONS, ROUTE_TOUR_MAP } from "./tour-definitions";
import type { TourDefinition, TourStep } from "./tour-types";
import { CoachMark } from "./coach-mark";

interface TourContextValue {
  // The tour registered for whatever route the user is on right now, or
  // null if this screen has none — this is what the single "Take a tour"
  // trigger reads, so it always launches (or replays) the CURRENT screen's
  // tour, never a different one from wherever the user happened to start.
  currentTourId: string | null;
  isSeen: (tourId: string) => boolean;
  // Always starts, even if already seen — this is what a deliberate replay
  // relies on.
  startTour: (tourId: string) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}

interface ActiveTour {
  definition: TourDefinition;
  stepIndex: number;
}

async function fetchTourContent(tourId: string): Promise<{ label: string; textByKey: Map<string, { title: string; body: string }> }> {
  const res = await fetch(`/api/tours/${tourId}`);
  const data = await res.json().catch(() => null);
  const tour = data?.tour ?? { tourLabel: tourId, steps: [] };
  return {
    label: tour.tourLabel,
    textByKey: new Map(tour.steps.map((s: { key: string; title: string; body: string }) => [s.key, { title: s.title, body: s.body }])),
  };
}

function mergeTour(
  tourId: string,
  label: string,
  textByKey: Map<string, { title: string; body: string }>
): TourDefinition {
  const structural = TOUR_DEFINITIONS[tourId];
  const steps: TourStep[] = structural.steps.map((s) => {
    const text = textByKey.get(s.key);
    return { key: s.key, target: s.target, placement: s.placement, title: text?.title ?? "", body: text?.body ?? "" };
  });
  return { id: tourId, label, steps };
}

/**
 * Mounts once per portal shell (business/layout.tsx, group/layout.tsx —
 * deliberately never admin/layout.tsx, the guided-tour feature is Business
 * and Parent Org only). Owns which tour is currently playing, resolves the
 * current route to its registered tour (ROUTE_TOUR_MAP), and persists
 * "seen" state back to the account via /api/tours/seen so it doesn't nag a
 * returning user, while still letting the "Take a tour" trigger force a
 * replay of whatever screen the user is actually on.
 */
export function TourProvider({ initialSeenTours, children }: { initialSeenTours: string[]; children: ReactNode }) {
  const pathname = usePathname();
  const [seenTours, setSeenTours] = useState<Set<string>>(() => new Set(initialSeenTours));
  const [active, setActive] = useState<ActiveTour | null>(null);
  const autoStartedRef = useRef<Set<string>>(new Set());

  const currentTourId = ROUTE_TOUR_MAP[pathname] ?? null;

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
    fetchTourContent(tourId).then(({ label, textByKey }) => {
      setActive({ definition: mergeTour(tourId, label, textByKey), stepIndex: 0 });
    });
  }, []);

  // First-visit auto-launch, driven by the route map rather than each page
  // opting itself in — once per tourId per session, so navigating back to
  // an already-shown-this-session screen doesn't replay it after a Skip.
  useEffect(() => {
    if (!currentTourId) return;
    if (seenTours.has(currentTourId)) return;
    if (autoStartedRef.current.has(currentTourId)) return;
    autoStartedRef.current.add(currentTourId);
    startTour(currentTourId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTourId, seenTours]);

  const endTour = useCallback(
    (tourId: string) => {
      setActive(null);
      markSeen(tourId);
    },
    [markSeen]
  );

  const value = useMemo<TourContextValue>(
    () => ({
      currentTourId,
      isSeen: (tourId) => seenTours.has(tourId),
      startTour,
    }),
    [currentTourId, seenTours, startTour]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && (
        <CoachMark
          definition={active.definition}
          stepIndex={active.stepIndex}
          onStepChange={(stepIndex) => setActive({ definition: active.definition, stepIndex })}
          onDone={() => endTour(active.definition.id)}
        />
      )}
    </TourContext.Provider>
  );
}
