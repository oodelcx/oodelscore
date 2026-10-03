"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Product = "customer_experience" | "colleague_experience";

/**
 * Only rendered when an account has BOTH products enabled — lets them pick
 * which one's aggregate dashboards (Overview, Command Center, Branches,
 * Compare, Regions, Reports) they're currently looking at. Persists via a
 * cookie (see /api/view-product + resolveViewProduct) so the choice holds
 * across pages and reloads.
 *
 * Refetches via router.refresh() inside a transition rather than
 * window.location.reload(): a full browser reload flashes the old,
 * still-in-memory page before the fresh response replaces it, which reads
 * as a "stale data" flicker. router.refresh() re-runs the Server Component
 * tree in place (no navigation, no white flash) — the layout above this
 * recomputes viewProduct from the now-updated cookie and, since it keys the
 * page content on viewProduct (see business/layout.tsx and
 * group/layout.tsx), React remounts that subtree, which re-triggers every
 * "use client" page's fetch-once-on-mount effect against the new product.
 */
export function ProductViewSwitcher({ current }: { current: Product }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [posting, setPosting] = useState(false);
  const pending = isPending || posting;

  async function switchTo(product: Product) {
    if (product === current || pending) return;
    setPosting(true);
    await fetch("/api/view-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product }),
    }).catch(() => null);
    setPosting(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="product-switcher" role="group" aria-label="Viewing">
      <button
        type="button"
        className={`product-switcher-btn${current === "customer_experience" ? " active" : ""}`}
        onClick={() => switchTo("customer_experience")}
        disabled={pending}
      >
        Customer
      </button>
      <button
        type="button"
        className={`product-switcher-btn${current === "colleague_experience" ? " active" : ""}`}
        onClick={() => switchTo("colleague_experience")}
        disabled={pending}
      >
        Colleague
      </button>
    </div>
  );
}
