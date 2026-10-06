"use client";

import { useEffect, useState } from "react";

/** Sticky "Capture · Clarify · Claim · Close · Confirm" bar that follows the reader down a product page. */
export function ChapterRail({ items, note }: { items: { id: string; label: string }[]; note?: string }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const targets = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    targets.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, [items]);

  return (
    <div className="ds-rail">
      <div className="ds-wrap ds-rail-in">
        {items.map((it, i) => (
          <a
            key={it.id}
            href={`#${it.id}`}
            className={active === it.id ? "on" : ""}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(it.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <i>{i + 1}</i>
            {it.label}
          </a>
        ))}
        {note && <span className="ds-rail-note">{note}</span>}
      </div>
    </div>
  );
}
