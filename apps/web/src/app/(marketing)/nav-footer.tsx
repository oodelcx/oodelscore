"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { INavItem } from "@oodelscore/shared";
import { BookDemoButton } from "./demo-modal";
import { ManageCookiesLink } from "./cookie-consent";

const PATH_BY_KEY: Record<string, string> = {
  product: "/product",
  solutions: "/solutions",
  "how-it-works": "/how-it-works",
  pricing: "/pricing",
  company: "/company",
  contact: "/contact",
};

interface MegaMenuLink {
  label: string;
  href: string;
}
interface MegaMenuColumn {
  label: string;
  items: MegaMenuLink[];
}
interface MegaMenuData {
  product: { columns: MegaMenuColumn[] };
  solutions: { columns: MegaMenuColumn[] };
}

/** "Platform" and "Solutions" open as a two-column mega-menu instead of a
 * plain link — content is fetched from /api/marketing/nav-menu, itself
 * built from the same admin-editable Site Content fields the /product and
 * /solutions pages render (features, industries), so the menu can never
 * drift out of sync with what those pages actually say. Every other nav
 * item stays a plain link. */
const MEGA_MENU_KEYS = new Set(["product", "solutions"]);

function MegaMenu({ menuKey, label, data, active }: { menuKey: "product" | "solutions"; label: string; data: MegaMenuColumn[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`nav-menu-item${open ? " open" : ""}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link
        href={PATH_BY_KEY[menuKey]}
        className={`nav-menu-trigger${active ? " active" : ""}`}
        onClick={() => setOpen(false)}
      >
        {label}
        <svg className="nav-menu-caret" viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      {open && data.length > 0 && (
        <div className="mega-panel">
          <div className="mega-panel-inner">
            {data.map((col) => (
              <div className="mega-col" key={col.label}>
                <h4>{col.label}</h4>
                {col.items.map((item) => (
                  <Link key={item.href + item.label} href={item.href} onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MarketingNav({
  active,
  navItems,
  headerStyle,
}: {
  active: string;
  navItems: INavItem[];
  /** "menu" Site Content field, admin-toggleable in Admin → Site Content →
   * Menu & Footer. Absent/anything but "dark" falls back to "light" (the
   * original look), so nothing breaks before an admin sets it. */
  headerStyle?: string;
}) {
  const visible = [...navItems].filter((n) => n.visible).sort((a, b) => a.order - b.order);
  const isDark = headerStyle === "dark";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaData, setMegaData] = useState<MegaMenuData | null>(null);

  useEffect(() => {
    fetch("/api/marketing/nav-menu")
      .then((r) => r.json())
      .then((d) => setMegaData(d))
      .catch(() => setMegaData(null));
  }, []);

  return (
    <nav className={`nav ${isDark ? "nav-dark" : "nav-light"}`}>
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <img src={isDark ? "/oodelcx-logo-white.webp" : "/oodelcx-logo-dark.webp"} alt="OodelCX" />
        </Link>
        <div className="nav-links">
          {visible.map((item) =>
            MEGA_MENU_KEYS.has(item.key) && megaData ? (
              <MegaMenu
                key={item.key}
                menuKey={item.key as "product" | "solutions"}
                label={item.label}
                active={active === item.key}
                data={megaData[item.key as "product" | "solutions"].columns}
              />
            ) : (
              <Link key={item.key} href={PATH_BY_KEY[item.key] ?? "/"} className={active === item.key ? "active" : ""}>
                {item.label}
              </Link>
            )
          )}
        </div>
        <div className="nav-right">
          <Link href="/login">Sign in</Link>
          <BookDemoButton className="btn-primary">Book a demo</BookDemoButton>
          {/* Only rendered/visible below the 860px breakpoint where
              .nav-links is hidden (marketing.css) — lives inside nav-right
              (not as a separate flex child of nav-inner) so it clusters
              with Sign in/Book a demo at the right edge instead of being
              spaced apart from them by nav-inner's space-between. Sign in
              and Book a demo both stay visible at mobile width; only the
              page links (Home/Product/…) move into the panel below. */}
          <button
            type="button"
            className="nav-mobile-toggle"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
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
// /product's overview — not the same thing as the "The mechanism" link
// below, which points at the deeper step-by-step /how-it-works page. Two
// different labels, two different URLs, on purpose.
const FOOTER_LINK_HREF: Record<string, string> = {
  "How it works": "/product",
  "The mechanism": "/how-it-works",
  "CX Pulse": "/#cx-pulse",
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
              <FooterLink key={i} label={label} fallback="/product" navItems={navItems} />
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
