import type { Metadata } from "next";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";

interface Plan {
  name: string;
  price: string;
  priceNote: string;
  featured: boolean;
  cta: string;
  features: string[];
}

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const pricing = await getSiteContent("pricing");
  const description = pricing.fields.metaDescription;
  return {
    title: "Pricing",
    description,
    openGraph: { title: "Pricing", description, url: "/pricing" },
    twitter: { title: "Pricing", description },
  };
}

export default async function PricingPage() {
  const [menu, pricing] = await Promise.all([getSiteContent("menu"), getSiteContent("pricing")]);
  const f = pricing.fields;
  const plans = parseJsonArray<Plan>(f.plans);

  return (
    <>
      <MarketingNav active="pricing" navItems={menu.navItems} />

      <section className="pricing-hero">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
          <p>{f.heroSubhead}</p>
        </div>
      </section>

      <div className="wrap">
        <div className="pricing-grid">
          {plans.map((plan, i) => (
            <div className={`plan ${plan.featured ? "featured" : ""}`} key={i}>
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price">{plan.price}</div>
              <div className="plan-unit">{plan.priceNote}</div>
              {plan.cta === "Start free trial" ? (
                // Self-serve signup/trial flow doesn't exist yet — a real
                // product decision, not wired here (see PR description).
                <a className="plan-cta" href="#">
                  {plan.cta}
                </a>
              ) : (
                <BookDemoButton className="plan-cta">{plan.cta}</BookDemoButton>
              )}
              {plan.features.map((feat, j) => (
                <div className="plan-feat" key={j}>
                  {feat}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="enterprise-note">
          {f.enterpriseNote} <BookDemoButton className="link-cta">Talk to us about volume pricing →</BookDemoButton>
        </div>
      </div>

      <MarketingFooter fields={menu.fields} />
    </>
  );
}
