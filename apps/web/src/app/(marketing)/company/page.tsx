import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { DemoForm } from "../ds/demo-form";
import { BookDemoButton } from "../demo-modal";
import { BeliefIcon } from "./icons";

interface Belief {
  icon: string;
  title: string;
  body: string;
}

interface FuncRow {
  label: string;
  cells: string[];
}

interface TrustItem {
  title: string;
  body: string;
}

/** Renders `highlight` (if it's an exact substring of `text`) in the accent treatment. Falls back to plain text if it doesn't match, so an edited headline never silently breaks. */
function withHighlight(text: string, highlight: string | undefined): ReactNode {
  const index = highlight ? text.indexOf(highlight) : -1;
  if (index === -1) return text;
  const end = index + (highlight as string).length;
  return (
    <>
      {text.slice(0, index)}
      <em className="ds-hl">{text.slice(index, end)}</em>
      {text.slice(end)}
    </>
  );
}

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const company = await getSiteContent("company");
  const description = company.fields.metaDescription;
  return {
    title: "Company",
    description,
    openGraph: { title: "Company", description, url: "/company", images: ["/og-image.png"] },
    twitter: { title: "Company", description, images: ["/og-image.png"] },
  };
}

export default async function CompanyPage() {
  const [menu, company] = await Promise.all([getSiteContent("menu"), getSiteContent("company")]);
  if (menu.navItems.find((n) => n.key === "company")?.visible === false) notFound();
  const f = company.fields;
  const storyParagraphs = parseJsonArray<string>(f.storyParagraphs);
  const beliefs = parseJsonArray<Belief>(f.beliefs);
  const funcColumns = parseJsonArray<string>(f.funcColumns);
  const funcRows = parseJsonArray<FuncRow>(f.funcRows);
  const trustItems = parseJsonArray<TrustItem>(f.trustItems);

  return (
    <>
      <MarketingNav active="company" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} navLabels={menu.fields} />

      <div className="ds-root">
        <section className="ds-ph-hero neu">
          <div className="ds-wrap ds-co-hero">
            <div>
              {f.heroEyebrow && <div className="ds-eyebrow">{f.heroEyebrow}</div>}
              <h1 className="ds-h1" style={{ marginTop: 10 }}>
                {withHighlight(f.heroHeadline, f.heroHighlight)}
              </h1>
              <p className="ds-lead" style={{ marginTop: 16 }}>
                {f.missionStatement}
              </p>
              <div className="ds-row" style={{ marginTop: 26 }}>
                <BookDemoButton className="ds-btn ds-btn-p">{menu.fields.navDemoLabel || "Book a demo"}</BookDemoButton>
                {f.heroSecondaryButton && (
                  <Link className="ds-btn ds-btn-g" href={f.heroSecondaryHref || "/solutions"}>
                    {f.heroSecondaryButton}
                  </Link>
                )}
              </div>
            </div>

            {funcRows.length > 0 && funcColumns.length > 0 && (
              <div className="ds-func" role="table" aria-label={f.funcTitle}>
                {f.funcTitle && <div className="ds-func-title">{f.funcTitle}</div>}
                <div className="ds-func-row ds-func-head" role="row" style={{ gridTemplateColumns: `1fr repeat(${funcColumns.length}, 1.3fr)` }}>
                  <span />
                  {funcColumns.map((c, i) => (
                    <b key={i} className={i === funcColumns.length - 1 ? "us" : ""} role="columnheader">
                      {c}
                    </b>
                  ))}
                </div>
                {funcRows.map((row, i) => (
                  <div className="ds-func-row" key={i} role="row" style={{ gridTemplateColumns: `1fr repeat(${funcColumns.length}, 1.3fr)` }}>
                    <b role="rowheader">{row.label}</b>
                    {(row.cells ?? []).slice(0, funcColumns.length).map((cell, j) => (
                      <span key={j} className={j === funcColumns.length - 1 ? "us" : ""} role="cell">
                        {cell}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {storyParagraphs.length > 0 && (
          <section className="ds-sec">
            <div className="ds-wrap ds-co-story">
              <div>
                {f.storyEyebrow && <div className="ds-eyebrow">{f.storyEyebrow}</div>}
                {f.storyHeadline && (
                  <h2 className="ds-h2" style={{ marginTop: 10 }}>
                    {f.storyHeadline}
                  </h2>
                )}
              </div>
              <div className="ds-co-prose">
                {storyParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {beliefs.length > 0 && (
          <section className="ds-sec ds-band-alt">
            <div className="ds-wrap">
              {f.beliefsEyebrow && <div className="ds-eyebrow">{f.beliefsEyebrow}</div>}
              {f.beliefsHeadline && (
                <h2 className="ds-h2" style={{ marginTop: 10 }}>
                  {f.beliefsHeadline}
                </h2>
              )}
              <div className="ds-co-grid">
                {beliefs.map((b, i) => (
                  <div className="ds-co-card" key={i}>
                    <div className="ds-co-icon">
                      <BeliefIcon name={b.icon} />
                    </div>
                    <h3>{b.title}</h3>
                    <p>{b.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {trustItems.length > 0 && (
          <section className="ds-sec">
            <div className="ds-wrap">
              {f.trustEyebrow && <div className="ds-eyebrow">{f.trustEyebrow}</div>}
              {f.trustHeadline && (
                <h2 className="ds-h2" style={{ marginTop: 10, maxWidth: "24ch" }}>
                  {f.trustHeadline}
                </h2>
              )}
              {f.trustIntro && (
                <p className="ds-lead" style={{ marginTop: 12 }}>
                  {f.trustIntro}
                </p>
              )}
              <div className="ds-trust-grid">
                {trustItems.map((t, i) => (
                  <div className="ds-trust-item" key={i}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5l4.2 4.2L19 7" />
                    </svg>
                    <div>
                      <b>{t.title}</b>
                      <p>{t.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="ds-sec ds-band-alt" id="demo">
          <div className="ds-wrap ds-contact">
            <div>
              <div className="ds-eyebrow">{f.demoEyebrow}</div>
              <h2 className="ds-h2" style={{ margin: "10px 0 14px" }}>
                {f.demoHeadline || f.finalCtaHeadline}
              </h2>
              <p className="ds-lead">{f.demoBody || f.finalCtaSubhead}</p>
              {f.contactEmail && (
                <p className="ds-lead" style={{ marginTop: 14, fontSize: 15 }}>
                  {f.demoEmailPrefix} <a href={`mailto:${f.contactEmail}`} style={{ color: "var(--acc-d)", fontWeight: 650 }}>{f.contactEmail}</a>
                </p>
              )}
            </div>
            <DemoForm labels={{ ...menu.fields, demoProductLabel: f.demoProductLabel }} options={parseJsonArray<string>(f.demoProductOptions)} />
          </div>
        </section>
      </div>

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
