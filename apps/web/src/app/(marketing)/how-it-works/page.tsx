import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";
import { Reveal } from "../scroll-reveal";

interface Step {
  title: string;
  body: string;
}

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const howItWorks = await getSiteContent("how-it-works");
  const description = howItWorks.fields.metaDescription;
  return {
    title: "How it works",
    description,
    openGraph: { title: "How it works", description, url: "/how-it-works", images: ["/og-image.png"] },
    twitter: { title: "How it works", description, images: ["/og-image.png"] },
  };
}

export default async function HowItWorksPage() {
  const [menu, howItWorks] = await Promise.all([getSiteContent("menu"), getSiteContent("how-it-works")]);
  if (menu.navItems.find((n) => n.key === "how-it-works")?.visible === false) notFound();
  const f = howItWorks.fields;
  const steps = parseJsonArray<Step>(f.steps);

  return (
    <>
      <MarketingNav active="how-it-works" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <section className="inner-hero">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
          <p>{f.heroBody}</p>
        </div>
      </section>

      <section className="how-steps-section">
        <div className="wrap">
          <div className="how-steps">
            {steps.map((step, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="how-step">
                  <div className="how-step-num">{i + 1}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="wrap">
          <h2>See the loop close on your own feedback.</h2>
          <p>Twenty minutes, a live walkthrough of real workflows — not a canned script.</p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <BookDemoButton className="btn-primary hover-lift">Book a demo</BookDemoButton>
            <a className="btn-ghost hover-lift" href="/product">
              See the product
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
