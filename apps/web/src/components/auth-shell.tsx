import type { ReactNode } from "react";
import "./auth-shell.css";

/** Splits headline on the first occurrence of highlight and wraps that
 * portion in the accent-green span — everything else renders plain white. */
function renderHeadline(headline: string, highlight: string): ReactNode {
  if (!highlight) return headline;
  const index = headline.indexOf(highlight);
  if (index === -1) return headline;
  return (
    <>
      {headline.slice(0, index)}
      <span className="as-highlight">{headline.slice(index, index + highlight.length)}</span>
      {headline.slice(index + highlight.length)}
    </>
  );
}

/**
 * Shared 75/25 shell for login/forgot-password/set-password — no mockup
 * ever designed these screens. The visual panel's headline is admin-editable
 * (Site Content -> Login). Fetched server-side by each page and passed down
 * as props — this used to fetch client-side in a useEffect, which meant the
 * hardcoded default text was always visible for a moment before the real
 * copy replaced it on every load. Plain props means the correct copy is in
 * the very first byte of HTML, no flash possible.
 */
export function AuthShell({
  headline,
  highlight,
  imageUrl,
  children,
}: {
  headline: string;
  highlight: string;
  imageUrl: string;
  children: ReactNode;
}) {
  return (
    <div className="as-shell">
      <div className="as-visual" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}>
        {imageUrl && <div className="as-visual-scrim" />}
        <div className="as-center">
          <img className="as-logo" src="/oodelcx-logo-white.webp" alt="OodelCX" />
          <p className="as-tagline">{renderHeadline(headline, highlight)}</p>
        </div>
      </div>
      <div className="as-form-panel">
        <div className="as-form-inner">{children}</div>
      </div>
    </div>
  );
}
