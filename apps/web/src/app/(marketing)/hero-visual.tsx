"use client";

import { useEffect, useState } from "react";

// Ports the mockup's orchestrated hero reveal: score count-up + sparkline draw-in.
export function HeroVisual() {
  const [score, setScore] = useState("0.00");
  const [dashOffset, setDashOffset] = useState(400);

  useEffect(() => {
    const target = 4.89;
    let cur = 0;
    let raf = 0;
    const step = () => {
      cur += (target - cur) * 0.12;
      if (target - cur < 0.01) {
        setScore(target.toFixed(2));
        return;
      }
      setScore(cur.toFixed(2));
      raf = requestAnimationFrame(step);
    };
    const startTimer = setTimeout(step, 300);
    const lineTimer = setTimeout(() => setDashOffset(0), 350);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(lineTimer);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="hero-visual">
      <div className="hv-card hv-main">
        <div className="hv-eyebrow">The Riverside Bistro</div>
        <div className="hv-title">This month</div>
        <div className="hv-score">{score}</div>
        <div className="hv-score-label">average score, 141 responses</div>
        <svg className="hv-spark" width="100%" height="46" viewBox="0 0 280 46">
          <polyline
            fill="none"
            stroke="#127C57"
            strokeWidth="2.4"
            points="0,30 30,26 60,32 90,20 120,24 150,14 180,18 210,10 240,14 270,6"
            strokeDasharray="400"
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1.1s ease" }}
          />
        </svg>
      </div>
      <div className="hv-card hv-pulse">
        <span className="hv-dot" /> CX Pulse — Improving
      </div>
      <div className="hv-card hv-action">
        <span className="pill">Action assigned</span>
        <div className="hv-action-title">Cleanliness dip, morning shift — Sam K.</div>
        <div className="hv-action-meta">Due in 2 days</div>
      </div>
    </div>
  );
}
