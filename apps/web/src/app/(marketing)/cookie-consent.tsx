"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "oodel-cookie-consent";
const EVENT_NAME = "oodel:cookie-consent-changed";

export interface CookieConsent {
  necessary: true;
  analytics: boolean;
  decidedAt: string;
}

/**
 * Reads the visitor's stored choice. Returns null if they haven't decided
 * yet. Free/self-hosted — no third-party consent-management vendor, no
 * network call: the choice lives in this browser's localStorage only, same
 * as every other per-viewer preference on this site.
 */
export function getCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookieConsent) : null;
  } catch {
    return null;
  }
}

function setCookieConsent(analytics: boolean) {
  const value: CookieConsent = { necessary: true, analytics, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private window / blocked storage — the banner just won't remember the
    // choice next visit, which is a safe fallback, not a broken one.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }));
}

/**
 * The only cookie this site sets on a first-time marketing visitor is
 * necessary (the login session cookie, set only once they actually sign
 * in — nothing fires on page load). There's no analytics script wired up
 * yet, so today this banner is pure future-proofing: the moment an
 * analytics snippet gets added, it should read getCookieConsent().analytics
 * before loading rather than firing unconditionally. Two buttons, one
 * optional category (Analytics) — no dark pattern where "Reject" is hidden
 * behind a second click.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [managing, setManaging] = useState(false);

  useEffect(() => {
    if (!getCookieConsent()) setVisible(true);
    const openManager = () => {
      setManaging(true);
      setVisible(true);
    };
    window.addEventListener("oodel:manage-cookies", openManager);
    return () => window.removeEventListener("oodel:manage-cookies", openManager);
  }, []);

  if (!visible) return null;

  function decide(analytics: boolean) {
    setCookieConsent(analytics);
    setVisible(false);
    setManaging(false);
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie preferences" aria-modal="false">
      <div className="cookie-banner-inner">
        <div className="cookie-banner-text">
          <strong>Cookies, kept minimal.</strong>
          <span>
            We use a necessary session cookie to keep you signed in — nothing else runs unless you allow it. See our{" "}
            <a href="/privacy">Privacy policy</a>.
          </span>
        </div>
        <div className="cookie-banner-actions">
          <button type="button" className="cookie-btn cookie-btn-ghost" onClick={() => decide(false)}>
            {managing ? "Necessary only" : "Reject non-essential"}
          </button>
          <button type="button" className="cookie-btn cookie-btn-primary" onClick={() => decide(true)}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

/** Footer "Manage cookies" link fires this — reopens the banner in "managing" mode without waiting for a fresh visit. */
export function ManageCookiesLink() {
  return (
    <button
      type="button"
      className="cookie-manage-link"
      onClick={() => window.dispatchEvent(new CustomEvent("oodel:manage-cookies"))}
    >
      Manage cookies
    </button>
  );
}
