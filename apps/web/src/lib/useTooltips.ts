"use client";

import { useEffect, useState } from "react";

/**
 * Client-side replacement for the old `await getTooltips(screenKey)` server
 * component call. Fires a request to /api/tooltips/[screen] on mount, in
 * parallel with whatever data fetch the page itself is doing, instead of
 * blocking the page's initial HTML on a DB round trip before the client JS
 * even loads. Returns `{}` until it resolves — InfoTip already renders
 * nothing for an undefined/missing key, so icons simply appear a beat after
 * the rest of the page rather than delaying it.
 */
export function useTooltips(screenKey: string): Record<string, string> {
  const [tooltips, setTooltips] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tooltips/${encodeURIComponent(screenKey)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTooltips(data.tooltips ?? {});
      })
      .catch(() => {
        /* tooltips are non-critical UI copy; a failed fetch just means no icons render */
      });
    return () => {
      cancelled = true;
    };
  }, [screenKey]);

  return tooltips;
}
