import Link from "next/link";
import type { INavItem } from "@oodelscore/shared";

const PATH_BY_KEY: Record<string, string> = {
  product: "/product",
  solutions: "/solutions",
  pricing: "/pricing",
  company: "/company",
};

export function MarketingNav({ active, navItems }: { active: string; navItems: INavItem[] }) {
  const visible = [...navItems].filter((n) => n.visible).sort((a, b) => a.order - b.order);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          oodel<span>.score</span>
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
          <a className="btn-primary" href="#demo">
            Book a demo
          </a>
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

export function MarketingFooter({ full, fields }: { full?: boolean; fields?: MenuFields }) {
  if (!full || !fields) {
    return (
      <footer>
        <div className="wrap">
          <div className="foot-bottom">{fields?.copyrightText ?? "© Oodel Score. All rights reserved."}</div>
        </div>
      </footer>
    );
  }

  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <div className="foot-logo">
              oodel<span>.score</span>
            </div>
            <div className="foot-desc">{fields.footerDescription}</div>
          </div>
          <div className="foot-col">
            <h4>Product</h4>
            {parseList(fields.footerProductLinks).map((label, i) => (
              <Link key={i} href="/product">
                {label}
              </Link>
            ))}
          </div>
          <div className="foot-col">
            <h4>Solutions</h4>
            {parseList(fields.footerSolutionsLinks).map((label, i) => (
              <Link key={i} href="/solutions">
                {label}
              </Link>
            ))}
          </div>
          <div className="foot-col">
            <h4>Company</h4>
            {parseList(fields.footerCompanyLinks).map((label, i) => (
              <Link key={i} href="/company">
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="foot-bottom">{fields.copyrightText}</div>
      </div>
    </footer>
  );
}
