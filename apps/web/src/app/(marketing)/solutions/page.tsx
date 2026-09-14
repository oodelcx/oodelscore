import type { Metadata } from "next";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const solutions = await getSiteContent("solutions");
  const description = solutions.fields.metaDescription;
  return {
    title: "Solutions",
    description,
    openGraph: { title: "Solutions", description, url: "/solutions" },
    twitter: { title: "Solutions", description },
  };
}

export default async function SolutionsPage() {
  const [menu, solutions] = await Promise.all([getSiteContent("menu"), getSiteContent("solutions")]);
  const f = solutions.fields;
  const singlePoints = parseJsonArray<string>(f.singlePoints);
  const groupPoints = parseJsonArray<string>(f.groupPoints);
  const entPoints = parseJsonArray<string>(f.entPoints);

  return (
    <>
      <MarketingNav active="solutions" navItems={menu.navItems} />

      <section className="inner-hero">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
          <p>{f.heroBody}</p>
        </div>
      </section>

      <div className="wrap">
        <div className="sol-grid">
          <div className="sol-panel">
            <div>
              <div className="sol-tag">Single business</div>
              <h3>{f.singleTitle}</h3>
              <p>No setup beyond your QR code. See every response, trend, and flagged issue in one dashboard from day one.</p>
            </div>
            <ul>
              {singlePoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
          <div className="sol-panel dark">
            <div>
              <div className="sol-tag">Multi-location groups</div>
              <h3>{f.groupTitle}</h3>
              <p>A parent organization sees every branch at once — and decides, branch by branch, how much runs centrally versus locally.</p>
            </div>
            <ul>
              {groupPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
          <div className="sol-panel">
            <div>
              <div className="sol-tag">Enterprise</div>
              <h3>{f.entTitle}</h3>
              <p>Networks of 100+ branches get dedicated support and finance-grade billing controls.</p>
            </div>
            <ul>
              {entPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <section className="final-cta">
        <div className="wrap">
          <h2>Tell us how your organization is structured.</h2>
          <p>We&rsquo;ll show you exactly how it maps onto OodelCX.</p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <BookDemoButton className="btn-primary">Book a demo</BookDemoButton>
            <a className="btn-ghost" href="/pricing">
              See pricing
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter fields={menu.fields} />
    </>
  );
}
