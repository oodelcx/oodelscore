"use client";

import { useEffect, useState, type ReactNode } from "react";
import "./auth-shell.css";

const DEFAULT_HEADLINE = "Every scan is someone telling you the truth.";
const DEFAULT_HIGHLIGHT = "the truth";

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
 * (Site Content -> Login), fetched client-side since this renders inside
 * "use client" pages.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const [headline, setHeadline] = useState(DEFAULT_HEADLINE);
  const [highlight, setHighlight] = useState(DEFAULT_HIGHLIGHT);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    fetch("/api/login-visual")
      .then((res) => res.json())
      .then((data) => {
        if (data.headline) setHeadline(data.headline);
        if (typeof data.highlight === "string") setHighlight(data.highlight);
        if (typeof data.imageUrl === "string") setImageUrl(data.imageUrl);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="as-shell">
      <div className="as-visual" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}>
        {imageUrl && <div className="as-visual-scrim" />}
        <div className="as-brand">
          oodel<span>.score</span>
        </div>
        <h1 className="as-headline">{renderHeadline(headline, highlight)}</h1>
      </div>
      <div className="as-form-panel">
        <div className="as-form-inner">{children}</div>
      </div>
    </div>
  );
}
