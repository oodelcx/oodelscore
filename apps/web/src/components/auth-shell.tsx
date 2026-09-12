import type { ReactNode } from "react";
import "./auth-shell.css";

/**
 * Shared 75/25 shell for login/forgot-password/set-password — no mockup
 * ever designed these screens, so this is a fresh layout: a branded visual
 * panel (no real photography available, so a designed dashboard-preview
 * mockup instead) plus a narrow form column, matching the pattern most
 * SaaS products use for their auth screens.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="as-shell">
      <div className="as-visual">
        <div className="as-visual-top">
          <div className="as-brand">
            oodel<span>.score</span>
          </div>
        </div>
        <div className="as-visual-card">
          <div className="as-card-eyebrow">Kestrel Bank — Branch Network</div>
          <div className="as-card-title">This quarter</div>
          <div className="as-card-score">92</div>
          <div className="as-card-score-label">CX Pulse composite — Embedded</div>
          <div className="as-card-rows">
            <div className="as-card-row">
              <span>Response speed</span>
              <span className="as-card-tag">96 / 100</span>
            </div>
            <div className="as-card-row">
              <span>Ownership</span>
              <span className="as-card-tag">88 / 100</span>
            </div>
            <div className="as-card-row">
              <span>Outcome</span>
              <span className="as-card-tag">91 / 100</span>
            </div>
          </div>
        </div>
        <div className="as-visual-bottom">
          <p className="as-quote">
            &ldquo;Every branch, one dashboard. We finally know which locations need help before customers tell us
            themselves.&rdquo;
          </p>
          <div className="as-quote-attr">VP of Customer Experience, multi-branch banking group</div>
        </div>
      </div>
      <div className="as-form-panel">
        <div className="as-form-inner">{children}</div>
      </div>
    </div>
  );
}
