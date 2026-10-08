"use client";

import { useEffect, useState } from "react";

interface Card {
  label: string;
  recognize: string;
  priority: "high" | "medium" | "low";
}

/**
 * One line under the CX Pulse score: what would move this account up, taken
 * from the first REACH recommendation on its Compass results. Renders nothing
 * when Compass is switched off, so Pulse never shows a dead end.
 */
export function PulseNextStep({ portal }: { portal: "business" | "group" }) {
  const [state, setState] = useState<"loading" | "off" | "none" | "todo" | "card">("loading");
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    fetch(`/api/${portal}/compass`)
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => null) }))
      .then(({ ok, data }) => {
        if (!ok || !data) return setState("off");
        if (data.assessmentStatus !== "completed") return setState("todo");
        const first: Card | undefined = (data.reach ?? [])[0];
        if (!first) return setState("none");
        setCard(first);
        setState("card");
      })
      .catch(() => setState("off"));
  }, [portal]);

  if (state === "loading" || state === "off") return null;
  const href = `/${portal}/compass#reach`;
  return (
    <div className="callout" style={{ marginBottom: 16 }} role="note">
      <b>What would move you up.</b>{" "}
      {state === "card" && card && (
        <>
          Your weakest area is <b>{card.label}</b>. {card.recognize} <a href={href}>See the recommendation →</a>
        </>
      )}
      {state === "todo" && (
        <>
          Take the Compass assessment to find out which area to work on first. <a href={`/${portal}/compass`}>Start Compass →</a>
        </>
      )}
      {state === "none" && <>Every Compass area is Embedded and backed by activity. Keep it up.</>}
    </div>
  );
}
