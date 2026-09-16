import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";
import { Reveal } from "../scroll-reveal";

interface Plan {
  name: string;
  price: string;
  priceNote: string;
  featured: boolean;
  cta: string;
  features: string[];
}
interface LoopStripItem {
  label: string;
  body: string;
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
    openGraph: { title: "Pricing", description, url: "/pricing", images: ["/og-image.png"] },
    twitter: { title: "Pricing", description, images: ["/og-image.png"] },
  };
}

export default async function PricingPage() {
  const [menu, pricing] = await Promise.all([getSiteContent("menu"), getSiteContent("pricing")]);
  if (menu.navItems.find((n) => n.key === "pricing")?.visible === false) notFound();
  const f = pricing.fields;
  const plans = parseJsonArray<Plan>(f.plans);
  const loopItems = parseJsonArray<LoopStripItem>(f.loopStripItems);

  return (
    <>
      <MarketingNav active="pricing" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <section className="pricing-hero">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
          <p>{f.heroSubhead}</p>
        </div>
      </section>

      <div className="wrap">
        {loopItems.length > 0 && (
          <Reveal>
            <div className="loop-strip">
              <h2>{f.loopStripHeadline}</h2>
              <div className="loop-strip-row">
                {loopItems.map((item, i) => (
                  <div className="loop-strip-item hover-lift" key={i}>
                    <div className="loop-strip-label">{item.label}</div>
                    <p>{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}
        <div className="pricing-grid">
          {plans.map((plan, i) => (
            <div className={`plan hover-lift ${plan.featured ? "featured" : ""}`} key={i}>
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

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
