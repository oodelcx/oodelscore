import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../../nav-footer";
import { BookDemoButton } from "../../demo-modal";
import { Reveal } from "../../scroll-reveal";

export const revalidate = 60;

interface IndustryDetail {
  slug: string;
  name: string;
  tagline: string;
  heroBody: string;
  locationNoun: string;
  standaloneBody: string;
  groupBody: string;
  benefits: string[];
}

type RouteParams = { params: Promise<{ slug: string }> };

async function getIndustry(slug: string): Promise<IndustryDetail | null> {
  const solutions = await getSiteContent("solutions");
  const industries = parseJsonArray<IndustryDetail>(solutions.fields.industryDetails);
  return industries.find((i) => i.slug === slug) ?? null;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const industry = await getIndustry(slug);
  if (!industry) return {};
  const title = `OodelCX for ${industry.name}`;
  const description = industry.heroBody;
  return {
    title,
    description,
    openGraph: { title, description, url: `/solutions/${slug}`, images: ["/og-image.png"] },
    twitter: { title, description, images: ["/og-image.png"] },
  };
}

export default async function IndustryPage({ params }: RouteParams) {
  const { slug } = await params;
  const [menu, industry] = await Promise.all([getSiteContent("menu"), getIndustry(slug)]);
  if (menu.navItems.find((n) => n.key === "solutions")?.visible === false) notFound();
  if (!industry) notFound();

  return (
    <>
      <MarketingNav active="solutions" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <section className="sector-hero">
        <div className="wrap">
          <div className="sector-eyebrow">{industry.name}</div>
          <h1>{industry.tagline}</h1>
          <div className="sector-hero-cta">
            <BookDemoButton className="btn-primary hover-lift">Book a demo</BookDemoButton>
            <Link className="btn-ghost hover-lift" href="/solutions">
              See all industries
            </Link>
          </div>
        </div>
      </section>

      <section className="sector-problem">
        <div className="wrap">
          <Reveal>
            <div className="sector-problem-block">
              <div className="sector-problem-label">The problem</div>
              <p>{industry.heroBody}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="fork">
        <div className="wrap">
          <div className="fork-grid">
            <Reveal>
              <div className="fork-card light hover-lift">
                <div className="fork-eyebrow">Single {industry.locationNoun}</div>
                <h2>Running it alone</h2>
                <p>{industry.standaloneBody}</p>
                <Link href="/pricing" className="fork-cta">
                  See standalone pricing →
                </Link>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="fork-card dark hover-lift">
                <div className="fork-eyebrow">Multi-{industry.locationNoun} / Group</div>
                <h2>Running a network</h2>
                <p>{industry.groupBody}</p>
                <Link href="/pricing" className="fork-cta">
                  See group pricing →
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="sector-benefits-section">
        <div className="wrap">
          <Reveal className="narrative-head">
            <h2>What {industry.name} teams get</h2>
          </Reveal>
          <div className="sector-benefits-list">
            {industry.benefits.map((benefit, i) => (
              <Reveal key={i} delay={i * 70}>
                <div className="sector-benefit-row">
                  <span className="sector-benefit-check" aria-hidden="true">
                    ✓
                  </span>
                  <p>{benefit}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="wrap">
          <h2>See it set up for {industry.name.toLowerCase()}.</h2>
          <p>Twenty minutes, a live walkthrough of real workflows — not a canned script.</p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <BookDemoButton className="btn-primary hover-lift">Book a demo</BookDemoButton>
            <Link className="btn-ghost hover-lift" href="/pricing">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
