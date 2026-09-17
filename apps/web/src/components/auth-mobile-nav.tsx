"use client";

import { useState } from "react";
import Link from "next/link";

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/product", label: "Product" },
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/company", label: "Company" },
];

/**
 * Mobile-only header for the auth pages (login/forgot-password/set-password)
 * — these sit outside the marketing (marketing) route group and its
 * MarketingNav, so on narrow viewports (where AuthShell hides the black
 * visual panel entirely, auth-shell.css) there was previously no branding
 * and no way back to the marketing site at all. CSS-hidden above 900px,
 * matching the breakpoint AuthShell already hides .as-visual at.
 */
export function AuthMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="as-mobile-nav">
      <div className="as-mobile-nav-bar">
        <button
          type="button"
          className="as-mobile-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <Link href="/" className="as-mobile-logo">
          <img src="/oodelcx-logo-dark.webp" alt="OodelCX" />
        </Link>
        <span className="as-mobile-toggle-spacer" />
      </div>
      {open && (
        <div className="as-mobile-panel">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
