"use client";

import { useEffect, useState } from "react";

/**
 * Small client-side island for the off-canvas mobile sidebar (Admin,
 * Business, Group portals — see admin.css's ".admin-sidebar" rules and the
 * `@media (max-width: 900px)` block added alongside this component).
 *
 * The three portal layouts are server components (they do `await
 * getCurrentUser()`, DB lookups, etc.), so this owns only the interactive
 * bit: a hamburger button in a slim sticky top bar, plus the open/closed
 * state. It doesn't hold a ref to the `<aside className="admin-sidebar">`
 * element — that's rendered by the (server) layout elsewhere in the tree —
 * so instead of DOM refs it toggles a class on `<html>`
 * (`mobile-nav-open`), and admin.css's off-canvas rules key off
 * `html.mobile-nav-open .admin-sidebar` / `html.mobile-nav-open
 * .mobile-nav-backdrop`. This mirrors the slide-in/backdrop/close-on-click-
 * outside interaction already built for the Case Management side panel
 * (see playbook-run-panel-slideout.tsx + the `.pb-slideout*` rules in
 * business.css), just without needing a shared parent to manage the state
 * in — here the toggle and the sidebar are siblings.
 */
export default function MobileNavToggle({ label }: { label: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("mobile-nav-open", open);
  }, [open]);

  // Belt-and-suspenders: every nav link is a plain `<a href>` (full page
  // navigation, not next/link), which already tears down this component's
  // state on click. This just guards against a future switch to client-side
  // routing silently leaving the overlay stuck open, and covers Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("mobile-nav-open");
    };
  }, []);

  return (
    <>
      <div className="mobile-topbar">
        <button
          type="button"
          className="mobile-nav-btn"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="mobile-nav-btn-bar" />
          <span className="mobile-nav-btn-bar" />
          <span className="mobile-nav-btn-bar" />
        </button>
        <span className="mobile-topbar-label">{label}</span>
      </div>
      {open && <div className="mobile-nav-backdrop" onClick={() => setOpen(false)} />}
    </>
  );
}
