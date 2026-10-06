"use client";

import { useState, type ReactNode } from "react";

interface Stage {
  label: string;
  title: string;
  body: string;
}

/**
 * The 5C Framework strip on Home: a step track plus one panel per stage. It
 * never advances on its own, and every panel sits in the same grid cell, so
 * the section keeps the height of its tallest panel and nothing below it
 * moves when a visitor switches stage. Panel illustrations arrive pre-rendered
 * from the server (`visuals`); all text is Site Content.
 */
export function FiveCLoop({ stages, stepFormat, visuals }: { stages: Stage[]; stepFormat: string; visuals: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const count = stages.length;
  if (count === 0) return null;
  const fill = count > 1 ? (active / (count - 1)) * 100 : 0;

  return (
    <div>
      <div className="ds-track" style={{ ["--fill" as string]: `${fill}%` }}>
        {stages.map((s, i) => (
          <button
            type="button"
            key={s.label}
            className={`ds-node${i === active ? " on" : ""}${i < active ? " past" : ""}`}
            onClick={() => setActive(i)}
            aria-current={i === active}
          >
            <i>{i + 1}</i>
            {s.label}
          </button>
        ))}
      </div>
      <div className="ds-loop-stack">
        {stages.map((stage, i) => {
          const eyebrow = stepFormat
            .replace("{n}", String(i + 1))
            .replace("{total}", String(count))
            .replace("{label}", stage.label);
          return (
            <div className={`ds-loop-panel${i === active ? "" : " off"}`} key={stage.label} aria-hidden={i !== active}>
              <div>
                <div className="ds-eyebrow">{eyebrow}</div>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
              </div>
              <div className="ds-vis">{visuals[i]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
