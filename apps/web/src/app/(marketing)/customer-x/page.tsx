import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";

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
  const product = await getSiteContent("customer-x");
  const description = product.fields.metaDescription;
  return {
    title: "Customer X",
    description,
    openGraph: { title: "Customer X", description, url: "/customer-x", images: ["/og-image.png"] },
    twitter: { title: "Customer X", description, images: ["/og-image.png"] },
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
  if (tag === "Root Cause Investigation") {
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
  if (tag === "Decision Log") {
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
  if (tag === "Feedback Collection") {
    return (
      <div className="mock-card">
        <div className="mock-action-title" style={{ marginBottom: 10 }}>
          Front Desk — QR feedback point
        </div>
        <div className="mock-qtype-row">
          <span>Scans this week</span>
          <span className="tag">312</span>
        </div>
        <div className="mock-qtype-row">
          <span>Responses</span>
          <span className="tag">204</span>
        </div>
        <div className="mock-qtype-row">
          <span>Median time to answer</span>
          <span className="tag">48s</span>
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
        <div className="mock-action-title">Star average dropped below 3.5 — Downtown branch</div>
        <div className="mock-action-meta">Sent to branch manager · 4 minutes ago</div>
      </div>
    );
  }
  if (tag === "Guided Playbooks") {
    return (
      <div className="mock-card">
        <div className="mock-action-title" style={{ marginBottom: 10 }}>
          Staff Friendliness Recovery
        </div>
        <div className="loop-frag-tags">
          <span className="loop-frag-tag">✓ Review flagged responses</span>
          <span className="loop-frag-tag">✓ Coach the team member</span>
          <span className="loop-frag-tag">Re-check score in 2 weeks</span>
        </div>
      </div>
    );
  }
  if (tag === "Escalation Workflows") {
    return (
      <div className="mock-card">
        <div className="mock-qtype-row">
          <span>Level 1 — Branch owner</span>
          <span className="tag">2 days</span>
        </div>
        <div className="mock-qtype-row">
          <span>Level 2 — Regional lead</span>
          <span className="tag">Escalated</span>
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
      <div className="mock-qtype-row">
        <span>Same period last quarter</span>
        <span className="tag">Improving</span>
      </div>
    </div>
  );
}

export default async function CustomerXPage() {
  const [menu, product] = await Promise.all([getSiteContent("menu"), getSiteContent("customer-x")]);
  if (menu.navItems.find((n) => n.key === "customer-x")?.visible === false) notFound();
  const f = product.fields;
  const features = parseJsonArray<Feature>(f.features);
  const groups: { id: "understand" | "act"; label: string; note: string }[] = [
    { id: "understand", label: "Understand", note: "Hear it, read it, find the cause" },
    { id: "act", label: "Act", note: "Own it, fix it, prove it worked" },
  ];

  return (
    <>
      <MarketingNav active="customer-x" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <div className="page-customer-x">
        <section className="cx-hero">
          <div className="wrap cx-hero-grid">
            <div>
              <span className="cx-chip">Customer X</span>
              <h1>{f.heroHeadline}</h1>
              <p>{f.heroSubheadline}</p>
              <div className="hero-ctas">
                <BookDemoButton className="btn-primary hover-lift">{f.finalCtaPrimaryButton || "Book a demo"}</BookDemoButton>
                <a className="btn-ghost hover-lift" href="/colleague-x">
                  See Colleague X
                </a>
              </div>
            </div>
            <div className="cx-hero-visual">
              <FeatureVisual tag="CX Pulse" />
            </div>
          </div>
        </section>

        {groups.map((g) => {
          const items = features.filter((feat) => (feat.group === "act" ? "act" : "understand") === g.id);
          if (items.length === 0) return null;
          return (
            <section className={`cx-group cx-group-${g.id}`} key={g.id}>
              <div className="wrap">
                <div className="cx-group-head">
                  <h2>{g.label}</h2>
                  <span>{g.note}</span>
                </div>
                <div className="cx-grid">
                  {items.map((feature) => (
                    <article className="cx-card" id={featureSlug(feature.tag)} key={feature.tag}>
                      <div className="feature-tag">{feature.tag}</div>
                      <h3>{feature.headline}</h3>
                      <p>{feature.body}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        <section className="final-cta">
          <div className="wrap">
            <h2>{f.finalCtaHeadline || "See the whole loop, start to finish."}</h2>
            <p>{f.finalCtaSubhead || "Twenty minutes, a live walkthrough of real workflows — not a canned script."}</p>
            <div className="hero-ctas" style={{ justifyContent: "center" }}>
              <BookDemoButton className="btn-primary hover-lift">{f.finalCtaPrimaryButton || "Book a demo"}</BookDemoButton>
              <a className="btn-ghost hover-lift" href="/login">
                {f.finalCtaSecondaryButton || "Sign in"}
              </a>
            </div>
          </div>
        </section>
      </div>

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
