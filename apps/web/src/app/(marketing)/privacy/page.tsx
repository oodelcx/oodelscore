import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";

interface BodySection {
  heading: string;
  text: string;
}

export const revalidate = 60;

export const metadata = {
  title: "Privacy Policy — OodelCX",
};

export default async function PrivacyPage() {
  const [menu, privacy] = await Promise.all([getSiteContent("menu"), getSiteContent("privacy")]);
  const f = privacy.fields;
  const sections = parseJsonArray<BodySection>(f.body);

  return (
    <>
      <MarketingNav active="privacy" navItems={menu.navItems} />

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
