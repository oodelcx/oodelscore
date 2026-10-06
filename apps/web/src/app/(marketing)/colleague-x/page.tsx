import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";

interface Feature {
  tag: string;
  headline: string;
  body: string;
  group?: "understand" | "act";
}

function featureSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const colleaguePulse = await getSiteContent("colleague-x");
  const description = colleaguePulse.fields.metaDescription;
  return {
    title: "Colleague X",
    description,
    openGraph: { title: "Colleague X", description, url: "/colleague-x", images: ["/og-image.png"] },
    twitter: { title: "Colleague X", description, images: ["/og-image.png"] },
  };
}

export default async function ColleagueXPage() {
  const [menu, colleague] = await Promise.all([getSiteContent("menu"), getSiteContent("colleague-x")]);
  if (menu.navItems.find((n) => n.key === "colleague-x")?.visible === false) notFound();
  const f = colleague.fields;
  const features = parseJsonArray<Feature>(f.features);

  return (
    <>
      <MarketingNav active="colleague-x" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <div className="page-colleague-x">
        <section className="ex-hero">
          <div className="wrap">
            <span className="ex-kicker">Colleague X</span>
            <h1>{f.heroHeadline}</h1>
            <p>{f.heroSubheadline}</p>
          </div>
        </section>

        <section className="ex-sheet">
          <div className="wrap ex-list">
            {features.map((feature) => (
              <article className="ex-row" id={featureSlug(feature.tag)} key={feature.tag}>
                <div className="ex-row-tag">
                  {feature.group === "act" ? "Act" : "Understand"} · {feature.tag}
                </div>
                <h3>{feature.headline}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ex-cta">
          <div className="wrap">
            <h2>{f.finalCtaHeadline || "See Colleague X running on real data."}</h2>
            <p>{f.finalCtaSubhead || "Twenty minutes, a live walkthrough of real workflows — not a canned script."}</p>
            <div className="hero-ctas">
              <BookDemoButton className="btn-primary hover-lift">{f.finalCtaPrimaryButton || "Book a demo"}</BookDemoButton>
              <a className="ex-ghost" href="/login">
                {f.finalCtaSecondaryButton || "Sign in"}
              </a>
            </div>
          </div>
        </section>
      </div>

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
