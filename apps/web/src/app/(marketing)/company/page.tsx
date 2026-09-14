import type { Metadata } from "next";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";

interface TitleBodyItem {
  title: string;
  body: string;
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
    openGraph: { title: "Company", description, url: "/company" },
    twitter: { title: "Company", description },
  };
}

export default async function CompanyPage() {
  const [menu, company] = await Promise.all([getSiteContent("menu"), getSiteContent("company")]);
  const f = company.fields;
  const items = parseJsonArray<TitleBodyItem>(f.howWeWorkItems);

  return (
    <>
      <MarketingNav active="company" navItems={menu.navItems} />

      <section className="inner-hero">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
        </div>
      </section>

      <div className="mission-block">
        <p>{f.missionStatement}</p>
      </div>

      <section className="why" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="narrative-head">
            <h2>How we work</h2>
          </div>
          <div className="why-grid">
            {items.map((item, i) => (
              <div className="why-item" key={i}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="wrap">
          <h2>Want to talk to us directly?</h2>
          <p>{f.contactEmail}</p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <BookDemoButton className="btn-primary">Book a demo</BookDemoButton>
          </div>
        </div>
      </section>

      <MarketingFooter fields={menu.fields} />
    </>
  );
}
