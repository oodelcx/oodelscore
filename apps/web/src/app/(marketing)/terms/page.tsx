import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";

interface BodySection {
  heading: string;
  text: string;
}

export const revalidate = 60;

export const metadata = {
  title: "Terms of Service — Oodel Score",
};

export default async function TermsPage() {
  const [menu, terms] = await Promise.all([getSiteContent("menu"), getSiteContent("terms")]);
  const f = terms.fields;
  const sections = parseJsonArray<BodySection>(f.body);

  return (
    <>
      <MarketingNav active="terms" navItems={menu.navItems} />

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

      <MarketingFooter fields={menu.fields} />
    </>
  );
}
