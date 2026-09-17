import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";
import { Reveal } from "../scroll-reveal";

interface Feature {
  tag: string;
  headline: string;
  body: string;
}

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const product = await getSiteContent("product");
  const description = product.fields.metaDescription;
  return {
    title: "The Platform",
    description,
    openGraph: { title: "The Platform", description, url: "/product", images: ["/og-image.png"] },
    twitter: { title: "The Platform", description, images: ["/og-image.png"] },
  };
}

// One small, real-product-shaped visual fragment per feature — labeled
// illustrative data only, same convention as hero-visual.tsx.
function FeatureVisual({ tag }: { tag: string }) {
  if (tag === "CX Pulse") {
    return (
      <div className="mock-card">
        <div className="mock-qtype-row">
          <span>Response</span>
          <span className="tag">38 / 100</span>
        </div>
        <div className="mock-qtype-row">
          <span>Ownership</span>
          <span className="tag">44 / 100</span>
        </div>
        <div className="mock-qtype-row">
          <span>Culture</span>
          <span className="tag">52 / 100</span>
        </div>
        <div className="mock-qtype-row">
          <span>Outcome</span>
          <span className="tag">49 / 100</span>
        </div>
      </div>
    );
  }
  if (tag === "Theme Intelligence") {
    return (
      <div className="mock-card">
        <div className="mock-action-title" style={{ marginBottom: 10 }}>
          Recurring themes — last 14 days
        </div>
        <div className="loop-frag-tags">
          <span className="loop-frag-tag">Wait time · 14</span>
          <span className="loop-frag-tag">Cleanliness · 6</span>
          <span className="loop-frag-tag">Staff · 3</span>
        </div>
      </div>
    );
  }
  if (tag === "Root Cause Analysis") {
    return (
      <div className="mock-card">
        <div className="mock-action-title" style={{ marginBottom: 6 }}>
          Wait time flagged — 5 responses
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
          Traced to: Saturday morning shift, Downtown branch — all 5 responses fall in the same 90-minute window.
        </p>
      </div>
    );
  }
  if (tag === "Driver Analysis") {
    return (
      <div className="mock-card">
        <div className="mock-qtype-row">
          <span>Wait time</span>
          <span className="tag">Strong link</span>
        </div>
        <div className="mock-qtype-row">
          <span>Cleanliness</span>
          <span className="tag">Moderate link</span>
        </div>
        <div className="mock-qtype-row">
          <span>Staff friendliness</span>
          <span className="tag">Weak link</span>
        </div>
      </div>
    );
  }
  if (tag === "Case Management") {
    return (
      <div className="mock-card mock-action-card">
        <span className="pill">Case assigned</span>
        <div className="mock-action-title">Cleanliness dip, morning shift — Sam K.</div>
        <div className="mock-action-meta">Due in 2 days · sourced from 3 flagged responses</div>
      </div>
    );
  }
  return (
    <div className="mock-card">
      <div className="mock-action-title" style={{ marginBottom: 8 }}>
        Self-checkout wait time — logged decision
      </div>
      <div className="loop-frag-chip">
        <span className="before">3.9</span>
        <span>→</span>
        <span className="after">4.6</span>
      </div>
    </div>
  );
}

export default async function ProductPage() {
  const [menu, product] = await Promise.all([getSiteContent("menu"), getSiteContent("product")]);
  if (menu.navItems.find((n) => n.key === "product")?.visible === false) notFound();
  const f = product.fields;
  const features = parseJsonArray<Feature>(f.features);

  return (
    <>
      <MarketingNav active="product" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <section className="product-intro">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
          <p>{f.heroSubheadline}</p>
        </div>
      </section>

      {features.map((feature, i) => (
        <section className={`feature-row${i % 2 === 1 ? " reverse" : ""}`} key={feature.tag} style={i % 2 === 1 ? { background: "var(--paper-alt)" } : undefined}>
          <div className="wrap">
            <Reveal>
              <div className="feature-tag">{feature.tag}</div>
              <h2>{feature.headline}</h2>
              <p>{feature.body}</p>
            </Reveal>
            <Reveal delay={80}>
              <FeatureVisual tag={feature.tag} />
            </Reveal>
          </div>
        </section>
      ))}

      <section className="final-cta">
        <div className="wrap">
          <h2>See the whole loop, start to finish.</h2>
          <p>Twenty minutes, a live walkthrough of real workflows — not a canned script.</p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <BookDemoButton className="btn-primary hover-lift">Book a demo</BookDemoButton>
            <a className="btn-ghost hover-lift" href="/login">
              Sign in
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
