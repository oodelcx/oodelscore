import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";
import { SectorTabs } from "./sector-tabs";

interface Sector {
  key: string;
  label: string;
  painPoints: string[];
  outcomes: string[];
  stats: { label: string; value: string }[];
}

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const industries = await getSiteContent("industries");
  const description = industries.fields.metaDescription;
  return {
    title: "Industries",
    description,
    openGraph: { title: "Industries", description, url: "/industries", images: ["/og-image.png"] },
    twitter: { title: "Industries", description, images: ["/og-image.png"] },
  };
}

export default async function IndustriesPage() {
  const [menu, industries] = await Promise.all([getSiteContent("menu"), getSiteContent("industries")]);
  if (menu.navItems.find((n) => n.key === "industries")?.visible === false) notFound();
  const f = industries.fields;
  const sectors = parseJsonArray<Sector>(f.sectors);

  return (
    <>
      <MarketingNav active="industries" navItems={menu.navItems} />

      <section className="inner-hero">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
          <p>{f.heroBody}</p>
        </div>
      </section>

      <div className="wrap" style={{ padding: "10px 0 90px" }}>
        <SectorTabs sectors={sectors} />
      </div>

      <section className="final-cta">
        <div className="wrap">
          <h2>Don&rsquo;t see your sector?</h2>
          <p>The loop applies wherever customers give feedback and someone needs to act on it.</p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <BookDemoButton className="btn-primary hover-lift">Book a demo</BookDemoButton>
            <a className="btn-ghost hover-lift" href="/solutions">
              See solutions
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter fields={menu.fields} />
    </>
  );
}
