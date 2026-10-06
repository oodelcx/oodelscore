import type { ReactNode } from "react";
import type { VizContent, CaseItem } from "./content";

/**
 * The stage illustrations. Every word in them comes from `VizContent`
 * (editable in Admin -> Site Content), and none of it is a screenshot of the
 * real app — these are drawn concept art in the site's own style.
 */

function Win({ children }: { children: ReactNode }) {
  return (
    <div className="ds-win">
      <div className="ds-win-body">{children}</div>
    </div>
  );
}

function CaseRow({ c }: { c: CaseItem }) {
  return (
    <div className="ds-case">
      <div className="ds-av">{c.initials}</div>
      <div>
        <b>{c.title}</b>
        <small>{c.sub}</small>
      </div>
      <span className={`ds-pill${c.tone === "warn" ? " warn" : ""}`} style={{ marginLeft: "auto" }}>
        {c.pill}
      </span>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="ds-chips">
      {items.map((c, i) => (
        <span className={`ds-chip${i === 0 ? " hot" : ""}`} key={i}>
          {c}
        </span>
      ))}
    </div>
  );
}

/** A deterministic QR-style pattern, so server and client always render the same one. */
function QrMock() {
  let seed = 7;
  const cells: ReactNode[] = [];
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      seed = (seed * 9301 + 49297) % 233280;
      if (!finder && seed / 233280 > 0.55) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="var(--ink)" />);
    }
  }
  const finders = [
    [0, 0],
    [14, 0],
    [0, 14],
  ].map(([x, y]) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="var(--ink)" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="var(--surface)" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="var(--ink)" />
    </g>
  ));
  return (
    <svg className="ds-qr" viewBox="0 0 21 21" shapeRendering="crispEdges" role="img" aria-label="QR code">
      <rect width="21" height="21" fill="var(--surface)" />
      {cells}
      {finders}
    </svg>
  );
}

function Phone({ v }: { v: VizContent["capture"] }) {
  return (
    <div className="ds-phone">
      <div className="ds-phone-in">
        <h6>{v.title}</h6>
        <div className="ds-stars">★★★★<span style={{ opacity: 0.3 }}>★</span></div>
        <div style={{ color: "var(--muted)" }}>{v.nps}</div>
        <div className="ds-nps">
          {Array.from({ length: 11 }, (_, i) => (
            <i key={i} className={i === 9 ? "sel" : ""}>
              {i}
            </i>
          ))}
        </div>
        <div className="ds-ta">{v.comment}</div>
        <div className="ds-send">{v.send}</div>
      </div>
    </div>
  );
}

export function CaptureVisual({ v }: { v: VizContent }) {
  return (
    <div className="ds-stage">
      <Phone v={v.capture} />
      <div className="ds-ways">
        <div className="ds-way">
          <QrMock />
          <span>
            <b>{v.capture.qrTitle}</b>
            <br />
            <small>{v.capture.qrSub}</small>
          </span>
        </div>
        <div className="ds-way ds-linkway">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
            <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
          </svg>
          <span>
            <b>{v.capture.linkTitle}</b>
            <br />
            <small>{v.capture.linkSub}</small>
          </span>
        </div>
      </div>
    </div>
  );
}

export function ClarifyVisual({ v }: { v: VizContent }) {
  const max = Math.max(1, ...v.themes.map((t) => Number(t.count) || 0));
  return (
    <div className="ds-stage">
      <Win>
        <div className="ds-bars">
          {v.themes.map((t, i) => (
            <div className="ds-bar" key={i}>
              <span>{t.label}</span>
              <i style={{ ["--w" as string]: `${Math.round(((Number(t.count) || 0) / max) * 86)}%` }} />
              <span>{t.count}</span>
            </div>
          ))}
        </div>
        <div className="ds-case">
          <div className="ds-av">{v.traced.badge}</div>
          <div>
            <b>{v.traced.title}</b>
            <small>{v.traced.body}</small>
          </div>
        </div>
      </Win>
    </div>
  );
}

export function RouteDiagram({ v }: { v: VizContent }) {
  const r = v.route;
  return (
    <Win>
      <div className="ds-route">
        <div className="ds-route-node">
          <b>{r.from}</b>
          <small>{r.fromSub}</small>
        </div>
        <svg className="ds-route-arrow" viewBox="0 0 48 14" fill="none" aria-hidden="true">
          <path d="M2 7h40M36 1.5L43 7l-7 5.5" stroke="var(--acc)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="ds-route-node to">
          <b>{r.to}</b>
          <small>{r.toSub}</small>
        </div>
      </div>
      <div className="ds-route-skip">
        <span className="ds-route-chip">{r.manager}</span>
        <em>{r.bypassed}</em>
      </div>
      {r.caption && <p className="ds-route-cap">{r.caption}</p>}
      {v.cases[0] && <CaseRow c={v.cases[0]} />}
    </Win>
  );
}

export function ClaimVisual({ v }: { v: VizContent }) {
  if (v.claimStyle === "route") {
    return (
      <div className="ds-stage">
        <RouteDiagram v={v} />
      </div>
    );
  }
  return (
    <div className="ds-stage">
      <Win>
        {v.cases.map((c, i) => (
          <CaseRow c={c} key={i} />
        ))}
        {v.playbookChips.length > 0 && <Chips items={v.playbookChips} />}
      </Win>
    </div>
  );
}

export function CloseVisual({ v }: { v: VizContent }) {
  const d = v.decision;
  return (
    <div className="ds-stage">
      <Win>
        <div className="ds-case" style={{ alignItems: "flex-start" }}>
          <div className="ds-av">{d.initials}</div>
          <div>
            <b>{d.title}</b>
            <small>{d.sub}</small>
          </div>
        </div>
        <div className="ds-beforeafter">
          <div>
            <small>{d.beforeLabel}</small>
            <div className="ds-ba-num dim">{d.before}</div>
          </div>
          <svg width="40" height="14" viewBox="0 0 40 14" fill="none" aria-hidden="true">
            <path d="M1 7h36M31 1l6 6-6 6" stroke="var(--acc)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <small>{d.afterLabel}</small>
            <div className="ds-ba-num hit">{d.after}</div>
          </div>
        </div>
        <div className="ds-case">
          <div className="ds-av">{v.reply.initials}</div>
          <div>
            <b>{v.reply.title}</b>
            <small>&ldquo;{v.reply.quote}&rdquo;</small>
          </div>
        </div>
      </Win>
    </div>
  );
}

export function ConfirmVisual({ v }: { v: VizContent }) {
  const l = v.ladder;
  return (
    <div className="ds-stage">
      <Win>
        {l.caption && <div className="ds-win-cap">{l.caption}</div>}
        <div className="ds-ladder">
          {l.names.map((name, i) => {
            const n = i + 1;
            const state = n < l.level ? "done" : n === l.level ? "now" : "";
            return (
              <div className={`ds-rung ${state}`} key={i}>
                <b>{n}</b>
                <span>{name}</span>
                <small>{n < l.level ? l.done : n === l.level ? l.now : l.next}</small>
              </div>
            );
          })}
        </div>
      </Win>
    </div>
  );
}

/** The dashboard-style hero illustration: three KPIs, a trend line, theme chips and one case. */
export function DashVisual({ v }: { v: VizContent }) {
  const d = v.dash;
  return (
    <>
    <Win>
      <div className="ds-kpis">
        {d.kpis.map((k, i) => (
          <div className="ds-kpi" key={i}>
            <small>{k.label}</small>
            <b>{k.value}</b>
            <em>{k.delta}</em>
          </div>
        ))}
      </div>
      <svg className="ds-spark" viewBox="0 0 300 74" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dsSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--acc)" stopOpacity=".35" />
            <stop offset="1" stopColor="var(--acc)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 58 L30 50 L60 54 L90 40 L120 44 L150 30 L180 34 L210 22 L240 26 L270 12 L300 16 L300 74 L0 74Z" fill="url(#dsSparkFill)" />
        <path d="M0 58 L30 50 L60 54 L90 40 L120 44 L150 30 L180 34 L210 22 L240 26 L270 12 L300 16" fill="none" stroke="var(--acc)" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="300" cy="16" r="4" fill="var(--acc)" />
      </svg>
      <Chips items={d.chips} />
      <CaseRow c={{ initials: d.caseInitials, title: d.caseTitle, sub: d.caseSub, pill: d.casePill }} />
    </Win>
    {v.note && <p className="ds-viz-note">{v.note}</p>}
    </>
  );
}

export { Phone as PhoneMock };

export function StageVisual({ stage, v }: { stage: string; v: VizContent }) {
  let body: ReactNode;
  switch (stage) {
    case "capture":
      body = <CaptureVisual v={v} />;
      break;
    case "clarify":
      body = <ClarifyVisual v={v} />;
      break;
    case "claim":
      body = <ClaimVisual v={v} />;
      break;
    case "close":
      body = <CloseVisual v={v} />;
      break;
    default:
      body = <ConfirmVisual v={v} />;
  }
  return (
    <>
      {body}
      {v.note && <p className="ds-viz-note">{v.note}</p>}
    </>
  );
}
