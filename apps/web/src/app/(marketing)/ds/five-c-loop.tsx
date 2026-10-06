"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface Stage {
  label: string;
  title: string;
  body: string;
}

/**
 * The interactive 5C Framework strip on Home: a progress track plus one panel
 * per stage, auto-advancing until the visitor hovers or clicks. Panel
 * illustrations arrive pre-rendered from the server (`visuals`), all text
 * from Site Content.
 */
export function FiveCLoop({ stages, stepFormat, visuals }: { stages: Stage[]; stepFormat: string; visuals: ReactNode[] }) {
  const [idx, setIdx] = useState(0);
  const paused = useRef(false);
  const count = stages.length;

  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (!paused.current) setIdx((i) => (i + 1) % count);
    }, 4200);
    return () => clearInterval(timer);
  }, [count]);

  if (count === 0) return null;
  const active = Math.min(idx, count - 1);
  const stage = stages[active];
  const eyebrow = stepFormat
    .replace("{n}", String(active + 1))
    .replace("{total}", String(count))
    .replace("{label}", stage.label);
  const fill = count > 1 ? (active / (count - 1)) * 100 : 0;

  return (
    <div onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}>
      <div className="ds-track" style={{ ["--fill" as string]: `${fill}%` }}>
        {stages.map((s, i) => (
          <button
            type="button"
            key={s.label}
            className={`ds-node${i === active ? " on" : ""}${i < active ? " past" : ""}`}
            onClick={() => setIdx(i)}
            aria-current={i === active}
          >
            <i>{i + 1}</i>
            {s.label}
          </button>
        ))}
      </div>
      <div className="ds-loop-panel" key={active}>
        <div>
          <div className="ds-eyebrow">{eyebrow}</div>
          <h3>{stage.title}</h3>
          <p>{stage.body}</p>
        </div>
        <div className="ds-vis">{visuals[active]}</div>
      </div>
    </div>
  );
}
