"use client";

import { useState } from "react";

interface Sector {
  key: string;
  label: string;
  painPoints: string[];
  outcomes: string[];
  stats: { label: string; value: string }[];
}

export function SectorTabs({ sectors }: { sectors: Sector[] }) {
  const [active, setActive] = useState(sectors[0]?.key);
  const current = sectors.find((s) => s.key === active) ?? sectors[0];
  if (!current) return null;

  return (
    <>
      <div className="sector-tabs" role="tablist" aria-label="Industries">
        {sectors.map((sector) => (
          <button
            key={sector.key}
            type="button"
            role="tab"
            aria-selected={sector.key === active}
            className={`sector-pill${sector.key === active ? " active" : ""}`}
            onClick={() => setActive(sector.key)}
          >
            {sector.label}
          </button>
        ))}
      </div>

      <div className="sector-panel" role="tabpanel">
        <h2>{current.label}</h2>
        <div className="sector-col-label">Where it breaks down</div>
        <ul>
          {current.painPoints.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
        <div className="sector-col-label">What OodelCX does</div>
        <ul>
          {current.outcomes.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
