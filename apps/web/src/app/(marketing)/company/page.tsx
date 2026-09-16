import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
    openGraph: { title: "Company", description, url: "/company", images: ["/og-image.png"] },
    twitter: { title: "Company", description, images: ["/og-image.png"] },
  };
}

export default async function CompanyPage() {
  const [menu, company] = await Promise.all([getSiteContent("menu"), getSiteContent("company")]);
  if (menu.navItems.find((n) => n.key === "company")?.visible === false) notFound();
  const f = company.fields;
  const items = parseJsonArray<TitleBodyItem>(f.howWeWorkItems);

  return (
    <>
      <MarketingNav active="company" navItems={menu.navItems} />

      <section className="quiet-hero">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
        </div>
      </section>

      <div className="quiet-mission">
        <p>{f.missionStatement}</p>
      </div>

      <div className="quiet-list">
        <div className="wrap">
          {items.map((item, i) => (
            <div className="quiet-list-item" key={i}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mission-block" style={{ paddingTop: 0, paddingBottom: 90 }}>
        <p style={{ fontSize: 15, color: "var(--text-2)" }}>
          Want to talk to us directly? <a href={`mailto:${f.contactEmail}`}>{f.contactEmail}</a> or{" "}
          <BookDemoButton className="link-cta" style={{ color: "var(--signal)", fontWeight: 500, cursor: "pointer" }}>
            book a demo
          </BookDemoButton>
          .
        </p>
      </div>

      <MarketingFooter fields={menu.fields} />
    </>
  );
}
