import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { Reveal } from "../scroll-reveal";
import { DemoForm } from "../ds/demo-form";
import { BeliefIcon, SectorIcon, StoryIllustration } from "./icons";

interface Belief {
  icon: string;
  title: string;
  body: string;
}

interface AudienceItem {
  slug: string;
  name: string;
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
  const storyParagraphs = parseJsonArray<string>(f.storyParagraphs);
  const beliefs = parseJsonArray<Belief>(f.beliefs);
  const audienceItems = parseJsonArray<AudienceItem>(f.audienceItems);

  return (
    <>
      <MarketingNav active="company" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} navLabels={menu.fields} />

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

      {storyParagraphs.length > 0 && (
        <section className="company-story">
          <div className="wrap company-story-grid">
            <Reveal as="div" className="company-story-text">
              {f.storyEyebrow && <div className="company-eyebrow">{f.storyEyebrow}</div>}
              {f.storyHeadline && <h2>{f.storyHeadline}</h2>}
              {storyParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </Reveal>
            <Reveal as="div" className="company-story-art" delay={100}>
              <StoryIllustration />
            </Reveal>
          </div>
        </section>
      )}

      {beliefs.length > 0 && (
        <section className="company-beliefs">
          <div className="wrap">
            <Reveal as="div" className="company-section-head">
              {f.beliefsEyebrow && <div className="company-eyebrow">{f.beliefsEyebrow}</div>}
              {f.beliefsHeadline && <h2>{f.beliefsHeadline}</h2>}
            </Reveal>
            <div className="company-beliefs-grid">
              {beliefs.map((b, i) => (
                <Reveal as="div" className="company-belief-card" key={i} delay={i * 70}>
                  <div className="company-belief-icon">
                    <BeliefIcon name={b.icon} />
                  </div>
                  <h3>{b.title}</h3>
                  <p>{b.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {audienceItems.length > 0 && (
        <section className="company-audience">
          <div className="wrap">
            <Reveal as="div" className="company-section-head company-section-head-narrow">
              {f.audienceEyebrow && <div className="company-eyebrow">{f.audienceEyebrow}</div>}
              {f.audienceHeadline && <h2>{f.audienceHeadline}</h2>}
            </Reveal>
            <div className="company-audience-grid">
              {audienceItems.map((a, i) => (
                <Reveal as="div" className="company-audience-card" key={a.slug} delay={i * 60}>
                  <div className="company-audience-icon">
                    <SectorIcon slug={a.slug} />
                  </div>
                  <h3>{a.name}</h3>
                  <p>{a.body}</p>
                </Reveal>
              ))}
            </div>
            <Reveal as="div" delay={240}>
              <Link href="/solutions" className="company-audience-link">
                {f.audienceLinkLabel || "See how it works for your industry →"}
              </Link>
            </Reveal>
          </div>
        </section>
      )}

      <div className="ds-root">
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
