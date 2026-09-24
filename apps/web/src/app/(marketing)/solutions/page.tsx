import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";
import { Reveal } from "../scroll-reveal";

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const solutions = await getSiteContent("solutions");
  const description = solutions.fields.metaDescription;
  return {
    title: "Solutions",
    description,
    openGraph: { title: "Solutions", description, url: "/solutions", images: ["/og-image.png"] },
    twitter: { title: "Solutions", description, images: ["/og-image.png"] },
  };
}

export default async function SolutionsPage() {
  const [menu, solutions] = await Promise.all([getSiteContent("menu"), getSiteContent("solutions")]);
  if (menu.navItems.find((n) => n.key === "solutions")?.visible === false) notFound();
  const f = solutions.fields;
  const singlePoints = parseJsonArray<string>(f.singlePoints);
  const groupPoints = parseJsonArray<string>(f.groupPoints);
  const entPoints = parseJsonArray<string>(f.entPoints);
  const industries = parseJsonArray<string>(f.industries);

  return (
    <>
      <MarketingNav active="solutions" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <section className="inner-hero">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
          <p>{f.heroBody}</p>
        </div>
      </section>

      <section className="fork" id="structure">
        <div className="wrap">
          <div className="fork-grid">
            <Reveal>
              <div className="fork-card light hover-lift" id="standalone">
                <div className="fork-eyebrow">Standalone</div>
                <h2>{f.singleTitle}</h2>
                <p>No setup beyond your QR code. See every response, trend, and flagged issue in one dashboard from day one.</p>
                <ul>
                  {singlePoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
                <Link href="/pricing" className="fork-cta">
                  See standalone pricing →
                </Link>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="fork-card dark hover-lift" id="group">
                <div className="fork-eyebrow">Multi-Branch / Group</div>
                <h2>{f.groupTitle}</h2>
                <p>A parent organization sees every branch at once — and decides, branch by branch, how much runs centrally versus locally.</p>
                <ul>
                  {groupPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
                <Link href="/pricing" className="fork-cta">
                  See group pricing →
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={160}>
            <div className="ent-strip hover-lift" id="enterprise">
              <div>
                <div className="fork-eyebrow">Enterprise</div>
                <h3 style={{ margin: 0, fontSize: 20 }}>{f.entTitle}</h3>
              </div>
              <ul>
                {entPoints.map((point, i) => (
                  <li key={i}>· {point}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="industries" id="industries">
        <div className="wrap">
          <Reveal>
            <h2>{f.industriesTitle}</h2>
            <p className="industries-sub">{f.industriesBody}</p>
            <div className="industry-chip-row">
              {industries.map((name) => (
                <span className="industry-chip" key={name}>
                  {name}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="final-cta">
        <div className="wrap">
          <h2>Tell us how your organization is structured.</h2>
          <p>We&rsquo;ll show you exactly how it maps onto OodelCX.</p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <BookDemoButton className="btn-primary hover-lift">Book a demo</BookDemoButton>
            <a className="btn-ghost hover-lift" href="/pricing">
              See pricing
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
