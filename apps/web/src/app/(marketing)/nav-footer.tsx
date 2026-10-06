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

interface FooterLinkDef {
  label: string;
  href: string;
}

interface FooterColumn {
  heading: string;
  links: FooterLinkDef[];
}

interface MenuFields {
  footerDescription?: string;
  footerEmail?: string;
  footerTagline?: string;
  footerColumns?: string;
  copyrightText?: string;
  navDemoLabel?: string;
}

function parseColumns(value: string | undefined): FooterColumn[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((c) => ({
        heading: String(c?.heading ?? ""),
        links: Array.isArray(c?.links)
          ? c.links.map((l: Partial<FooterLinkDef>) => ({ label: String(l?.label ?? ""), href: String(l?.href ?? "") })).filter((l: FooterLinkDef) => l.label)
          : [],
      }))
      .filter((c: FooterColumn) => c.heading || c.links.length);
  } catch {
    return [];
  }
}

// Reverse of PATH_BY_KEY: lets a footer link be skipped the same way its nav
// link is when an admin hides that page (Admin -> Site Content -> Menu & Footer).
const NAV_KEY_BY_PATH: Record<string, string> = Object.fromEntries(
  Object.entries(PATH_BY_KEY).map(([key, path]) => [path, key])
);

function isHiddenByNav(href: string, navItems: INavItem[]): boolean {
  const navKey = NAV_KEY_BY_PATH[href];
  if (!navKey) return false; // not a gated marketing page (a sector page, Privacy, Terms, an anchor): always show
  const item = navItems.find((n) => n.key === navKey);
  return item?.visible === false;
}

function FooterLink({ link, navItems }: { link: FooterLinkDef; navItems: INavItem[] }) {
  const { label, href } = link;
  if (/^(https?:|mailto:)/i.test(href)) {
    return (
      <a href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
        {label}
      </a>
    );
  }
  if (isHiddenByNav(href, navItems)) return null;
  return <Link href={href || "/"}>{label}</Link>;
}

/** Same footer on every marketing page: brand block plus any number of link columns, all Site Content. */
export function MarketingFooter({ fields, navItems }: { fields?: MenuFields; navItems: INavItem[] }) {
  const columns = parseColumns(fields?.footerColumns);
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid" style={{ gridTemplateColumns: `1.5fr repeat(${Math.max(columns.length, 1)}, 1fr)` }}>
          <div>
            <Link href="/" className="foot-logo">
              <img src="/oodelcx-logo-dark.webp" alt="OodelCX" />
            </Link>
            <div className="foot-desc">{fields?.footerDescription}</div>
            {fields?.footerEmail && (
              <a className="foot-mail" href={`mailto:${fields.footerEmail}`}>
                {fields.footerEmail}
              </a>
            )}
          </div>
          {columns.map((col, i) => (
            <div className="foot-col" key={i}>
              <h4>{col.heading}</h4>
              {col.links.map((l, j) => (
                <FooterLink key={j} link={l} navItems={navItems} />
              ))}
            </div>
          ))}
        </div>
        <div className="foot-bottom">
          <span>{fields?.copyrightText ?? "© OodelCX. All rights reserved."}</span>
          {fields?.footerTagline && <span>{fields.footerTagline}</span>}
          <ManageCookiesLink />
        </div>
      </div>
    </footer>
  );
}
