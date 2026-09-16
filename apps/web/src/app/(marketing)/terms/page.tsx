import type { Metadata } from "next";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";

interface BodySection {
  heading: string;
  text: string;
}

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const terms = await getSiteContent("terms");
  const description = terms.fields.metaDescription;
  return {
    title: "Terms of Service",
    description,
    openGraph: { title: "Terms of Service", description, url: "/terms", images: ["/og-image.png"] },
    twitter: { title: "Terms of Service", description, images: ["/og-image.png"] },
  };
}

export default async function TermsPage() {
  const [menu, terms] = await Promise.all([getSiteContent("menu"), getSiteContent("terms")]);
  const f = terms.fields;
  const sections = parseJsonArray<BodySection>(f.body);

  return (
    <>
      <MarketingNav active="terms" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <section className="inner-hero">
        <div className="wrap">
          <h1>{f.heading}</h1>
          <p className="last-updated">Last updated {f.lastUpdated}</p>
        </div>
      </section>

      <div className="wrap legal-body">
        {sections.map((section, i) => (
          <div key={i} className="legal-section">
            <h3>{section.heading}</h3>
            <p>{section.text}</p>
          </div>
        ))}
      </div>

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
