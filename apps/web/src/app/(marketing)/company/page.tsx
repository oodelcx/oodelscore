import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";
import { Reveal } from "../scroll-reveal";

interface TitleBodyItem {
  title: string;
  body: string;
}

/** Renders `highlight` (if it's an exact substring of `text`) in the italic
 * accent-green treatment — same convention as the login screen's headline
 * highlighting. Falls back to plain text if it doesn't match, so an edited
 * headline never silently breaks. */
function withHighlight(text: string, highlight: string | undefined): ReactNode {
  const index = highlight ? text.indexOf(highlight) : -1;
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <em className="quiet-accent">{text.slice(index, index + (highlight as string).length)}</em>
      {text.slice(index + (highlight as string).length)}
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
  const items = parseJsonArray<TitleBodyItem>(f.howWeWorkItems);

  return (
    <>
      <MarketingNav active="company" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <section className="quiet-hero">
        <div className="wrap quiet-hero-grid">
          <Reveal as="div" className="quiet-hero-headline">
            <h1>{withHighlight(f.heroHeadline, f.heroHighlight)}</h1>
          </Reveal>
          <Reveal as="div" className="quiet-hero-body" delay={80}>
            <p>{f.missionStatement}</p>
          </Reveal>
        </div>
      </section>

      <div className="quiet-list">
        <div className="wrap">
          {items.map((item, i) => (
            <Reveal as="div" className="quiet-list-item" key={i} delay={i * 70}>
              <span className="quiet-list-index">{String(i + 1).padStart(2, "0")}</span>
              <div className="quiet-list-content">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="mission-block" style={{ paddingTop: 0, paddingBottom: 90 }}>
        <p style={{ fontSize: 15, color: "var(--text-2)" }}>
          Want to talk to us directly? <a href={`mailto:${f.contactEmail}`}>{f.contactEmail}</a> or{" "}
          <BookDemoButton className="btn-green-inline">Book a demo</BookDemoButton>
        </p>
      </div>

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
