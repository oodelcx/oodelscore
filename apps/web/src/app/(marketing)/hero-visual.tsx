"use client";

import { useEffect, useState } from "react";

// Three explicitly-labeled sample cards, auto-rotating — no real business,
// no attributed quote or review, just illustrative numbers. Each slide
// shows a different real part of the product (multi-branch oversight, the
// Listen/Act/Measure loop, and an Action Board item) instead of a single
// static score, since a lone number undersold what the platform does.

const SLIDE_COUNT = 3;
const DEFAULT_INTERVAL_SECONDS = 3;

function SlideCommandCenter() {
  const rows: { label: string; cells: { value: string; band: "green" | "amber" | "red" }[] }[] = [
    {
      label: "Cleanliness",
      cells: [
        { value: "4.8", band: "green" },
        { value: "4.6", band: "green" },
        { value: "3.9", band: "amber" },
      ],
    },
    {
      label: "Wait time",
      cells: [
        { value: "4.1", band: "amber" },
        { value: "4.7", band: "green" },
        { value: "3.2", band: "red" },
      ],
    },
    {
      label: "Staff",
      cells: [
        { value: "4.9", band: "green" },
        { value: "4.8", band: "green" },
        { value: "4.6", band: "green" },
      ],
    },
  ];
  return (
    <>
      <span className="hv-example-badge">Meridian Bank Group</span>
      <div className="hv-stats-row">
        <div className="hv-stat">
          <div className="hv-stat-num">4.7</div>
          <div className="hv-stat-label">Avg score</div>
        </div>
        <div className="hv-stat">
          <div className="hv-stat-num">62</div>
          <div className="hv-stat-label">NPS</div>
        </div>
        <div className="hv-stat">
          <div className="hv-stat-num">3</div>
          <div className="hv-stat-label">Branches</div>
        </div>
      </div>
      <div className="hv-matrix">
        {rows.map((row) => (
          <div className="hv-matrix-row" key={row.label}>
            <span className="hv-matrix-label">{row.label}</span>
            <div className="hv-matrix-cells">
              {row.cells.map((cell, i) => (
                <span className={`hv-cell hv-cell-${cell.band}`} key={i}>
                  {cell.value}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SlideLoop() {
  return (
    <>
      <span className="hv-example-badge">Bank</span>
      <div className="hv-loop">
        <div className="hv-loop-stage">
          <div className="hv-loop-icon">★</div>
          <div className="hv-loop-label">Listen</div>
          <div className="hv-loop-sub">141 responses</div>
        </div>
        <div className="hv-loop-arrow">›</div>
        <div className="hv-loop-stage">
          <div className="hv-loop-icon">✓</div>
          <div className="hv-loop-label">Act</div>
          <div className="hv-loop-sub">6 resolved</div>
        </div>
        <div className="hv-loop-arrow">›</div>
        <div className="hv-loop-stage">
          <div className="hv-loop-icon">◎</div>
          <div className="hv-loop-label">Measure</div>
          <div className="hv-loop-sub">Level 4</div>
        </div>
      </div>
      <div className="hv-loop-score-row">
        <span className="hv-loop-score">78</span>
        <span className="hv-loop-level">/100 · Improving</span>
      </div>
    </>
  );
}

function SlideAction() {
  return (
    <>
      <span className="hv-example-badge">Bank</span>
      <div className="hv-stats-row">
        <div className="hv-stat">
          <div className="hv-stat-num">4.89</div>
          <div className="hv-stat-label">Avg score</div>
        </div>
        <div className="hv-stat">
          <div className="hv-stat-num">61</div>
          <div className="hv-stat-label">NPS</div>
        </div>
        <div className="hv-stat">
          <div className="hv-stat-num">141</div>
          <div className="hv-stat-label">Responses</div>
        </div>
      </div>
      <div className="hv-divider" />
      <div className="hv-action-row">
        <span className="hv-action-dot" />
        <span className="hv-action-title">Wait time flagged — Downtown branch</span>
        <span className="hv-action-owner">Sarah · Due Fri</span>
      </div>
    </>
  );
}

export function HeroVisual({ intervalSeconds = DEFAULT_INTERVAL_SECONDS }: { intervalSeconds?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!intervalSeconds || intervalSeconds <= 0) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDE_COUNT), intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [intervalSeconds]);

  return (
    <div className="hero-visual">
      <div className="hv-carousel">
        <div className="hv-example" key={index}>
          {index === 0 && <SlideCommandCenter />}
          {index === 1 && <SlideLoop />}
          {index === 2 && <SlideAction />}
        </div>
      </div>
      <div className="hv-dots">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={`hv-dot${i === index ? " active" : ""}`}
            onClick={() => setIndex(i)}
            aria-label={`Show example ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
