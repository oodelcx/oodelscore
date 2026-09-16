import Link from "next/link";
import type { INavItem } from "@oodelscore/shared";
import { BookDemoButton } from "./demo-modal";

const PATH_BY_KEY: Record<string, string> = {
  product: "/product",
  solutions: "/solutions",
  industries: "/industries",
  pricing: "/pricing",
  company: "/company",
};

export function MarketingNav({ active, navItems }: { active: string; navItems: INavItem[] }) {
  const visible = [...navItems].filter((n) => n.visible).sort((a, b) => a.order - b.order);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <img src="/oodelcx-logo-dark.webp" alt="OodelCX" />
        </Link>
        <div className="nav-links">
          {visible.map((item) => (
            <Link key={item.key} href={PATH_BY_KEY[item.key] ?? "/"} className={active === item.key ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </div>
        <div className="nav-right">
          <Link href="/login">Sign in</Link>
          <BookDemoButton className="btn-primary">Book a demo</BookDemoButton>
        </div>
      </div>
    </nav>
  );
}

interface MenuFields {
  footerDescription?: string;
  footerProductLinks?: string;
  footerSolutionsLinks?: string;
  footerCompanyLinks?: string;
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
const FOOTER_LINK_HREF: Record<string, string> = {
  "How it works": "/product",
  "CX Pulse": "/#cx-pulse",
  Pricing: "/pricing",
  "Single business": "/solutions",
  "Multi-location groups": "/solutions",
  Enterprise: "/solutions",
  Industries: "/industries",
  About: "/company",
  "Privacy policy": "/privacy",
  Terms: "/terms",
};

function FooterLink({ label, fallback }: { label: string; fallback: string }) {
  if (label.includes("@")) return <a href={`mailto:${label}`}>{label}</a>;
  return <Link href={FOOTER_LINK_HREF[label] ?? fallback}>{label}</Link>;
}

/** Same full 4-column footer on every marketing page — this is the site's
 * one standard footer, not something that varies page to page. */
export function MarketingFooter({ fields }: { fields?: MenuFields }) {
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
            <h4>Product</h4>
            {parseList(fields?.footerProductLinks).map((label, i) => (
              <FooterLink key={i} label={label} fallback="/product" />
            ))}
          </div>
          <div className="foot-col">
            <h4>Solutions</h4>
            {parseList(fields?.footerSolutionsLinks).map((label, i) => (
              <FooterLink key={i} label={label} fallback="/solutions" />
            ))}
          </div>
          <div className="foot-col">
            <h4>Company</h4>
            {parseList(fields?.footerCompanyLinks).map((label, i) => (
              <FooterLink key={i} label={label} fallback="/company" />
            ))}
          </div>
        </div>
        <div className="foot-bottom">{fields?.copyrightText ?? "© OodelCX. All rights reserved."}</div>
      </div>
    </footer>
  );
}
