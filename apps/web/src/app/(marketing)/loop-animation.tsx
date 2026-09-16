"use client";

/**
 * Sketch-style, hand-drawn-looking line animation of the Listen → Understand
 * → Act → Measure loop, for the Home hero. Pure inline SVG + CSS (no new
 * dependencies) — every stroke "draws itself" via the `pathLength="100"` +
 * `stroke-dasharray`/`stroke-dashoffset` technique so the CSS keyframes
 * (marketing.css, "LOOP ANIMATION" section) don't need to know each path's
 * real geometric length. A single 12s cycle sequences four stages (scan →
 * fetch → act → measure), holds on the assembled result, then fades out and
 * loops. Respects prefers-reduced-motion the same way scroll-reveal.tsx
 * does: a plain CSS media query forces the final, fully-drawn state and
 * disables animation — no JS branching here.
 */
export function LoopAnimation() {
  return (
    <div className="loop-anim">
      <svg className="la-svg" viewBox="0 0 860 190" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {/* ---- Stage 1: Scan — sketch figure holds a phone to a QR tile ---- */}
        <g className="la-stage">
          <circle className="la-draw la-t-s1" pathLength={100} cx="46" cy="34" r="10" />
          <path className="la-draw la-t-s1" pathLength={100} d="M46,44 L44,84 M44,84 L34,110 M44,84 L56,108" />
          <path className="la-draw la-t-s1" pathLength={100} d="M46,54 L68,42" />
          <rect className="la-draw la-t-s1" pathLength={100} x="66" y="20" width="26" height="42" rx="3" />
          <g className="la-qr la-t-qr">
            <path d="M73,28 h5 M73,33 h5 M80,28 h4 M86,28 h4" />
            <path d="M73,40 h4 M80,38 h3 M80,44 h6 M87,40 h3" />
            <path d="M73,48 h5 M81,49 h3 M87,47 h4" />
          </g>
        </g>

        {/* Connector 1 */}
        <g className="la-connector la-t-c1">
          <path d="M96,40 C 140,10 190,10 230,40" strokeDasharray="1 9" />
        </g>

        {/* ---- Stage 2: Fetch — data lands in a dashboard card ---- */}
        <g className="la-stage">
          <rect className="la-draw la-t-s2" pathLength={100} x="236" y="14" width="120" height="80" rx="10" />
          <path className="la-draw la-t-s2" pathLength={100} d="M252,32 h40" />
          <rect className="la-bar la-t-b1" x="252" y="46" width="12" height="30" rx="2" />
          <rect className="la-bar la-t-b2" x="272" y="58" width="12" height="18" rx="2" />
          <rect className="la-bar la-t-b3" x="292" y="38" width="12" height="38" rx="2" />
        </g>

        {/* Connector 2 */}
        <g className="la-connector la-t-c2">
          <path d="M358,54 C 400,24 440,24 470,54" strokeDasharray="1 9" />
        </g>

        {/* ---- Stage 3: Act — a task card gets checked off ---- */}
        <g className="la-stage">
          <rect className="la-draw la-t-s3" pathLength={100} x="476" y="20" width="150" height="68" rx="10" />
          <rect className="la-draw la-t-s3box" pathLength={100} x="494" y="42" width="22" height="22" rx="4" />
          <path className="la-draw la-check la-t-s3check" pathLength={100} d="M498,53 L508,62 L522,44" />
          <path className="la-draw la-task-line la-t-s3lines" pathLength={100} d="M528,48 h78 M528,62 h56" />
        </g>

        {/* Connector 3 */}
        <g className="la-connector la-t-c3">
          <path d="M626,54 C 660,26 690,26 716,54" strokeDasharray="1 9" />
        </g>

        {/* ---- Stage 4: Measure — the score visibly climbs ---- */}
        <g className="la-stage">
          <path className="la-draw la-arrow la-t-s4arrow" pathLength={100} d="M726,84 L764,44 M764,44 L752,45 M764,44 L763,56" />
          <path className="la-draw la-gauge la-t-s4gauge" pathLength={100} d="M726,110 a40,40 0 1 1 80,0" />
          <text className="la-score la-t-scorebefore" x="766" y="118">
            62
          </text>
          <text className="la-score la-score-after la-t-scoreafter" x="766" y="118">
            74
          </text>
        </g>
      </svg>
    </div>
  );
}
