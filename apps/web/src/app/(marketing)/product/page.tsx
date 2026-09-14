import type { Metadata } from "next";
import { getSiteContent } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const product = await getSiteContent("product");
  const description = product.fields.metaDescription;
  return {
    title: "Product",
    description,
    openGraph: { title: "Product", description, url: "/product" },
    twitter: { title: "Product", description },
  };
}

export default async function ProductPage() {
  const [menu, product] = await Promise.all([getSiteContent("menu"), getSiteContent("product")]);
  const f = product.fields;

  return (
    <>
      <MarketingNav active="product" navItems={menu.navItems} />

      <section className="inner-hero">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
          <p>{f.heroSubheadline}</p>
        </div>
      </section>

      <section className="feature-row">
        <div className="wrap">
          <div>
            <div className="feature-tag">Listen</div>
            <h2>{f.listenHeadline}</h2>
            <p>{f.listenBody}</p>
            <ul className="feature-list">
              <li>9 question types: star rating, NPS, open text, yes/no, emoji scale, multiple choice, multi-select, slider, dropdown</li>
              <li>Demographic fields (name, email, phone, age, gender) — each independently off, optional, or required</li>
              <li>Choose one question per screen, or all questions on one page, per QR code</li>
            </ul>
          </div>
          <div className="mock-card">
            <div className="mock-qtype-row">
              <span>How would you rate today&rsquo;s visit?</span>
              <span className="tag">Star rating</span>
            </div>
            <div className="mock-qtype-row">
              <span>How likely are you to recommend us?</span>
              <span className="tag">NPS 0–10</span>
            </div>
            <div className="mock-qtype-row">
              <span>Anything else you&rsquo;d like us to know?</span>
              <span className="tag">Open text</span>
            </div>
            <div className="mock-qtype-row">
              <span>Did a staff member greet you?</span>
              <span className="tag">Yes / No</span>
            </div>
          </div>
        </div>
      </section>

      <section className="feature-row reverse" style={{ background: "var(--paper-alt)" }}>
        <div className="wrap">
          <div>
            <div className="feature-tag">Act</div>
            <h2>{f.actHeadline}</h2>
            <p>{f.actBody}</p>
            <ul className="feature-list">
              <li>
                <b>Action Board</b> — every flagged response, assigned, tracked to resolution
              </li>
              <li>
                <b>Decision Log</b> — bigger changes, with the trigger that caused them and a measured before/after outcome
              </li>
              <li>
                <b>Playbooks</b> — standard guidance for recurring issues, so a manager isn&rsquo;t improvising
              </li>
            </ul>
          </div>
          <div className="mock-card mock-action-card">
            <span className="pill">Action assigned</span>
            <div className="mock-action-title">Cleanliness dip, morning shift — Sam K.</div>
            <div className="mock-action-meta">Due in 2 days · sourced from 3 flagged responses</div>
          </div>
        </div>
      </section>

      <section className="feature-row">
        <div className="wrap">
          <div>
            <div className="feature-tag">Measure</div>
            <h2>{f.measureHeadline}</h2>
            <p>{f.measureBody}</p>
            <a className="btn-ghost" href="/#solutions">
              See the CX Pulse levels →
            </a>
          </div>
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
        </div>
      </section>

      <section className="feature-row reverse" style={{ background: "var(--paper-alt)" }}>
        <div className="wrap">
          <div>
            <div className="feature-tag">AI Insights</div>
            <h2>{f.aiHeadline}</h2>
            <p>{f.aiBody}</p>
          </div>
          <div className="mock-card">
            <div className="mock-action-title" style={{ marginBottom: 10 }}>
              September weekly report
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
              Average score up 2.7% this week. Cleanliness remains the category most mentioned in comments — three flagged responses
              now have an owner assigned.
            </p>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="wrap">
          <h2>See the whole loop in your own data.</h2>
          <p>Twenty minutes, no generic demo script.</p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <BookDemoButton className="btn-primary">Book a demo</BookDemoButton>
            <a className="btn-ghost" href="/login">
              Sign in
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter fields={menu.fields} />
    </>
  );
}
