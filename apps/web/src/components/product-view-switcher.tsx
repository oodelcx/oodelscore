"use client";

import { useState } from "react";

type Product = "customer_experience" | "colleague_experience";

/**
 * Only rendered when an account has BOTH products enabled — lets them pick
 * which one's aggregate dashboards (Overview, Command Center, Branches,
 * Compare, Regions, Reports) they're currently looking at. Persists via a
 * cookie (see /api/view-product + resolveViewProduct) so the choice holds
 * across pages and reloads.
 *
 * Forces a full page reload rather than router.refresh(): almost every page
 * under /business and /group fetches its own data client-side in a "use
 * client" component's useEffect (fetch-once-on-mount), not via the Server
 * Component tree — router.refresh() only re-renders Server Components, so
 * an already-mounted page's data never re-fetches and the switch silently
 * does nothing. A reload remounts everything against the now-updated cookie.
 */
export function ProductViewSwitcher({ current }: { current: Product }) {
  const [pending, setPending] = useState(false);

  async function switchTo(product: Product) {
    if (product === current || pending) return;
    setPending(true);
    await fetch("/api/view-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product }),
    }).catch(() => null);
    window.location.reload();
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
