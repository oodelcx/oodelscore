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
  const colleaguePulse = await getSiteContent("colleague-pulse");
  const description = colleaguePulse.fields.metaDescription;
  return {
    title: "Colleague Pulse",
    description,
    openGraph: { title: "Colleague Pulse", description, url: "/colleague-pulse", images: ["/og-image.png"] },
    twitter: { title: "Colleague Pulse", description, images: ["/og-image.png"] },
  };
}

// One small, real-product-shaped visual fragment per feature, mirroring
// /product's FeatureVisual — labeled illustrative data only.
function FeatureVisual({ tag }: { tag: string }) {
  if (tag === "Colleague Pulse Score") {
    return (
      <div className="mock-card">
        <div className="mock-qtype-row">
          <span>Awareness</span>
          <span className="tag">41 / 100</span>
        </div>
        <div className="mock-qtype-row">
          <span>Response</span>
          <span className="tag">36 / 100</span>
        </div>
        <div className="mock-qtype-row">
          <span>Ownership</span>
          <span className="tag">52 / 100</span>
        </div>
        <div className="mock-qtype-row">
          <span>Outcome</span>
          <span className="tag">47 / 100</span>
        </div>
      </div>
    );
  }
  if (tag === "eNPS") {
    return (
      <div className="mock-card mock-action-card">
        <span className="pill">eNPS this quarter</span>
        <div className="mock-action-title">+18</div>
        <div className="mock-action-meta">Up from +9 last quarter · 142 responses</div>
      </div>
    );
  }
  if (tag === "Sensitive-Category Routing") {
    return (
      <div className="mock-card">
        <div className="mock-qtype-row">
          <span>Category: HR / Leadership concern</span>
          <span className="tag">Routes to HR</span>
        </div>
        <div className="mock-qtype-row">
          <span>Category: Facilities</span>
          <span className="tag">Routes to line manager</span>
        </div>
      </div>
    );
  }
  if (tag === "Colleague Roster") {
    return (
      <div className="mock-card">
        <div className="mock-action-title" style={{ marginBottom: 10 }}>
          Downtown Branch — Roster
        </div>
        <div className="mock-qtype-row">
          <span>Colleagues on roster</span>
          <span className="tag">24</span>
        </div>
        <div className="mock-qtype-row">
          <span>Responded this cycle</span>
          <span className="tag">19</span>
        </div>
      </div>
    );
  }
  if (tag === "CX ↔ EX Correlation") {
    return (
      <div className="mock-card">
        <div className="mock-action-title" style={{ marginBottom: 6 }}>
          Downtown Branch — 6 week view
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
          Colleague Pulse dropped 8 points in week 2. Customer star average dropped 0.4 in week 4.
        </p>
      </div>
    );
  }
  if (tag === "Colleague Feedback Collection") {
    return (
      <div className="mock-card">
        <div className="mock-action-title" style={{ marginBottom: 10 }}>
          Break Room — colleague feedback point
        </div>
        <div className="mock-qtype-row">
          <span>Scans this week</span>
          <span className="tag">58</span>
        </div>
        <div className="mock-qtype-row">
          <span>Responses</span>
          <span className="tag">41</span>
        </div>
      </div>
    );
  }
  if (tag === "Automatic Alerts") {
    return (
      <div className="mock-card mock-action-card">
        <span className="pill" style={{ background: "var(--paper-alt)" }}>
          Alert triggered
        </span>
        <div className="mock-action-title">eNPS dropped below threshold — Downtown branch</div>
        <div className="mock-action-meta">Sent to regional HR lead · 12 minutes ago</div>
      </div>
    );
  }
  if (tag === "Case Management") {
    return (
      <div className="mock-card mock-action-card">
        <span className="pill">Case assigned</span>
        <div className="mock-action-title">Scheduling complaint, night shift — R. Osei</div>
        <div className="mock-action-meta">Due in 3 days · sourced from 4 flagged responses</div>
      </div>
    );
  }
  if (tag === "Guided Playbooks") {
    return (
      <div className="mock-card">
        <div className="mock-action-title" style={{ marginBottom: 10 }}>
          Equipment Complaint Response
        </div>
        <div className="loop-frag-tags">
          <span className="loop-frag-tag">✓ Log fault with facilities</span>
          <span className="loop-frag-tag">✓ Confirm repair window with team</span>
          <span className="loop-frag-tag">Re-check score in 2 weeks</span>
        </div>
      </div>
    );
  }
  if (tag === "Decision Log") {
    return (
      <div className="mock-card">
        <div className="mock-action-title" style={{ marginBottom: 8 }}>
          Shift-swap policy change — logged decision
        </div>
        <div className="loop-frag-chip">
          <span className="before">31</span>
          <span>→</span>
          <span className="after">52</span>
        </div>
      </div>
    );
  }
  return (
    <div className="mock-card">
      <div className="mock-qtype-row">
        <span>This month</span>
        <span className="tag">On track</span>
      </div>
      <div className="mock-qtype-row">
        <span>Last month</span>
        <span className="tag">Behind</span>
      </div>
    </div>
  );
}

export default async function ColleaguePulsePage() {
  const [menu, colleaguePulse] = await Promise.all([getSiteContent("menu"), getSiteContent("colleague-pulse")]);
  if (menu.navItems.find((n) => n.key === "colleague-pulse")?.visible === false) notFound();
  const f = colleaguePulse.fields;
  const features = parseJsonArray<Feature>(f.features);

  return (
    <>
      <MarketingNav active="colleague-pulse" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <section className="product-intro">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
          <p>{f.heroSubheadline}</p>
        </div>
      </section>

      {features.map((feature, i) => (
        <section
          id={featureSlug(feature.tag)}
          className={`feature-row${i % 2 === 1 ? " reverse" : ""}`}
          key={feature.tag}
          style={i % 2 === 1 ? { background: "var(--paper-alt)" } : undefined}
        >
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
          <h2>See Colleague Pulse running on real data.</h2>
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
