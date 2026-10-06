"use client";

import { useState } from "react";
import Link from "next/link";
import type { INavItem } from "@oodelscore/shared";
import { BookDemoButton } from "./demo-modal";
import { ManageCookiesLink } from "./cookie-consent";

const PATH_BY_KEY: Record<string, string> = {
  "customer-x": "/customer-x",
  "colleague-x": "/colleague-x",
  solutions: "/solutions",
  "how-it-works": "/how-it-works",
  pricing: "/pricing",
  company: "/company",
  contact: "/contact",
};

/** Shared text fields for the header (all editable under Admin -> Site Content -> Menu & Footer). */
type NavLabels = Record<string, string | undefined>;

export function MarketingNav({
  active,
  navItems,
  headerStyle,
  navLabels,
}: {
  active: string;
  navItems: INavItem[];
  /** "menu" Site Content field, admin-toggleable in Admin → Site Content →
   * Menu & Footer. Absent/anything but "dark" falls back to "light" (the
   * original look), so nothing breaks before an admin sets it. */
  headerStyle?: string;
  navLabels?: NavLabels;
}) {
  const isDark = headerStyle === "dark";
  const [mobileOpen, setMobileOpen] = useState(false);
  const signIn = navLabels?.navSignInLabel || "Sign in";
  const demo = navLabels?.navDemoLabel || "Book a demo";

  // Flat menu: every visible top-level item, in the order set in Admin.
  const visible = navItems.filter((item) => !item.parentKey && item.visible).sort((a, b) => a.order - b.order);

  return (
    <nav className={`nav ${isDark ? "nav-dark" : "nav-light"}`}>
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <img src={isDark ? "/oodelcx-logo-white.webp" : "/oodelcx-logo-dark.webp"} alt="OodelCX" />
        </Link>
        <div className="nav-links">
          {visible.map((item) => (
            <Link key={item.key} href={PATH_BY_KEY[item.key] ?? "/"} className={active === item.key ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </div>
        <div className="nav-right">
          <Link href="/login">{signIn}</Link>
          <BookDemoButton className="btn-primary">{demo}</BookDemoButton>
          <button
            type="button"
            className="nav-mobile-toggle"
            aria-label={mobileOpen ? navLabels?.mobileMenuCloseLabel || "Close menu" : navLabels?.mobileMenuOpenLabel || "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="nav-mobile-panel">
          {visible.map((item) => (
            <Link
              key={item.key}
              href={PATH_BY_KEY[item.key] ?? "/"}
              className={active === item.key ? "active" : ""}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setMobileOpen(false)}>
            {signIn}
          </Link>
        </div>
      )}
    </nav>
  );
}

interface MenuFields {
  footerDescription?: string;
  footerProductLinks?: string;
  footerSolutionsLinks?: string;
  footerCompanyLinks?: string;
  footerProductHeading?: string;
  footerSolutionsHeading?: string;
  footerCompanyHeading?: string;
  copyrightText?: string;
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Every footer link routes to a real page — nothing here is a dead anchor.
// "How it works" (Product column) is a distinct, older link straight to
// /customer-x's overview — not the same thing as the "The mechanism" link
// below, which points at the deeper step-by-step /how-it-works page. Two
// different labels, two different URLs, on purpose.
const FOOTER_LINK_HREF: Record<string, string> = {
  "How it works": "/customer-x",
  "The mechanism": "/how-it-works",
  "CX Pulse": "/#cx-pulse",
  "Colleague Pulse": "/colleague-x",
  "Colleague X": "/colleague-x",
  Pricing: "/pricing",
  Solutions: "/solutions",
  Industries: "/how-it-works",
  About: "/company",
  Contact: "/contact",
  "Privacy policy": "/privacy",
  Terms: "/terms",
};

// Reverse of PATH_BY_KEY — lets a footer link's resolved href be matched
// back to the nav item that gates the page it points to, so a footer link
// can be skipped the same way the nav link already is when an admin hides
// that page (Admin → Site Content → Menu & Footer).
const NAV_KEY_BY_PATH: Record<string, string> = Object.fromEntries(
  Object.entries(PATH_BY_KEY).map(([key, path]) => [path, key])
);

function isHiddenByNav(href: string, navItems: INavItem[]): boolean {
  const navKey = NAV_KEY_BY_PATH[href];
  if (!navKey) return false; // not a gated marketing page (About/Privacy/Terms/CX Pulse anchor, etc.) — always show
  const item = navItems.find((n) => n.key === navKey);
  return item?.visible === false;
}

function FooterLink({ label, fallback, navItems }: { label: string; fallback: string; navItems: INavItem[] }) {
  if (label.includes("@")) return <a href={`mailto:${label}`}>{label}</a>;
  const href = FOOTER_LINK_HREF[label] ?? fallback;
  if (isHiddenByNav(href, navItems)) return null;
  return <Link href={href}>{label}</Link>;
}

/** Same full 4-column footer on every marketing page — this is the site's
 * one standard footer, not something that varies page to page. */
export function MarketingFooter({ fields, navItems }: { fields?: MenuFields; navItems: INavItem[] }) {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Link href="/" className="foot-logo">
              <img src="/oodelcx-logo-dark.webp" alt="OodelCX" />
            </Link>
            <div className="foot-desc">{fields?.footerDescription}</div>
          </div>
          <div className="foot-col">
            <h4>{fields?.footerProductHeading || "Product"}</h4>
            {parseList(fields?.footerProductLinks).map((label, i) => (
              <FooterLink key={i} label={label} fallback="/customer-x" navItems={navItems} />
            ))}
          </div>
          <div className="foot-col">
            <h4>{fields?.footerSolutionsHeading || "Solutions"}</h4>
            {parseList(fields?.footerSolutionsLinks).map((label, i) => (
              <FooterLink key={i} label={label} fallback="/solutions" navItems={navItems} />
            ))}
          </div>
          <div className="foot-col">
            <h4>{fields?.footerCompanyHeading || "Company"}</h4>
            {parseList(fields?.footerCompanyLinks).map((label, i) => (
              <FooterLink key={i} label={label} fallback="/company" navItems={navItems} />
            ))}
          </div>
        </div>
        <div className="foot-bottom">
          <span>{fields?.copyrightText ?? "© OodelCX. All rights reserved."}</span>
          <ManageCookiesLink />
        </div>
      </div>
    </footer>
  );
}
