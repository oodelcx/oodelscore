"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** On a group with both products: how many branches are struggling with customers and staff at once. Renders nothing when there are none, or when the account or user has no access to the page. */
export function BothSignalsCallout() {
  const [n, setN] = useState<{ both: number; staff: number } | null>(null);
  useEffect(() => {
    fetch("/api/group/cx-ex-correlation")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.status === "ok") setN({ both: d.network.quadrants.both_low, staff: d.network.quadrants.staff_low }); })
      .catch(() => null);
  }, []);
  if (!n || (n.both === 0 && n.staff === 0)) return null;
  return (
    <div className={`callout ${n.both ? "callout-amber" : ""}`} style={{ marginBottom: 16 }}>
      {n.both > 0 && <><strong>{n.both} branch{n.both === 1 ? " is" : "es are"} struggling with both customers and staff.</strong> </>}
      {n.staff > 0 && <>{n.staff} more {n.staff === 1 ? "has" : "have"} unhappy staff but customers are fine so far (an early warning). </>}
      <Link href="/group/cx-ex-correlation">See the customer ↔ staff story →</Link>
    </div>
  );
}
