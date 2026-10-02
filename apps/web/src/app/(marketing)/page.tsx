import type { Metadata } from "next";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "./nav-footer";
import { BookDemoButton } from "./demo-modal";
import { Reveal } from "./scroll-reveal";

interface NarrativeStep {
  label: string;
  title: string;
  body: string;
}
interface LoopStage {
  label: string;
  title: string;
  body: string;
}

// The 5 C's, in order — tops up a shorter stored loopStages array (a
// SiteContent doc saved before the 5C rename shipped, still holding only 4
// stages) so the live page always renders all five, without depending on
// an Admin re-save to fix a doc that already existed in the database.
const DEFAULT_LOOP_STAGES: LoopStage[] = [
  { label: "Capture", title: "Collect", body: "A QR scan, a short survey, no app or login." },
  { label: "Clarify", title: "Make sense of it", body: "Themes, root causes, and drivers surfaced automatically." },
  { label: "Claim", title: "Own it", body: "An owned case in Case Management, not a comment nobody reads." },
  { label: "Close", title: "Follow through", body: "Reply to the person who raised it and log the decision that fixed it." },
  { label: "Confirm", title: "Know if it worked", body: "CX Pulse tracks whether the loop is actually closing." },
];

function withDefaultLoopStages(stages: LoopStage[]): LoopStage[] {
  if (stages.length >= DEFAULT_LOOP_STAGES.length) return stages;
  return [...stages, ...DEFAULT_LOOP_STAGES.slice(stages.length)];
}
interface CxLevel {
  level: string;
  name: string;
  desc: string;
}
interface TitleBodyItem {
  title: string;
  body: string;
}

function splitChips(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const home = await getSiteContent("home");
  const title = "OodelCX — Feedback that turns into action";
  const description = home.fields.metaDescription;
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, url: "/", images: ["/og-image.png"] },
    twitter: { title, description, images: ["/og-image.png"] },
  };
}

// Small, real-product-shaped UI fragments for each loop stage — built from
// the same visual primitives as hero-visual.tsx (labeled example data,
// never presented as a live customer), not illustrations or fake photos.
function StageFragment({ stage }: { stage: string }) {
  if (stage === "Capture") {
    return (
      <div className="loop-frag-bubble">
        &ldquo;Wait time was a bit long today&rdquo;
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-3)" }}>via QR · 42s ago</div>
      </div>
    );
  }
  if (stage === "Clarify") {
    return (
      <div className="loop-frag-tags">
        <span className="loop-frag-tag">Wait time · 14</span>
        <span className="loop-frag-tag">Cleanliness · 6</span>
        <span className="loop-frag-tag">Staff · 3</span>
      </div>
    );
  }
  if (stage === "Claim") {
    return (
      <div className="loop-frag-action">
        <span className="dot" />
        <span style={{ flex: 1 }}>Wait time flagged — Downtown</span>
        <span style={{ color: "var(--text-3)" }}>Sam · Fri</span>
      </div>
    );
  }
  if (stage === "Close") {
    return (
      <div className="loop-frag-close">
        <span className="check">✓</span>
        <span style={{ flex: 1 }}>Reply sent to customer</span>
      </div>
    );
  }
  return (
    <div className="loop-frag-chip">
      <span className="before">3.9</span>
      <span>→</span>
      <span className="after">4.6</span>
    </div>
  );
}

export default async function MarketingHomePage() {
  const [menu, home] = await Promise.all([getSiteContent("menu"), getSiteContent("home")]);
  const f = home.fields;
  const loopStages = withDefaultLoopStages(parseJsonArray<LoopStage>(f.loopStages));
  const steps = parseJsonArray<NarrativeStep>(f.narrativeSteps);
  const levels = parseJsonArray<CxLevel>(f.cxPulseLevels);
  const whyItems = parseJsonArray<TitleBodyItem>(f.whyItems);

  return (
    <>
      <MarketingNav active="home" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <section className="loop-hero">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
          <p className="loop-hero-sub">{f.heroSubheadline}</p>
          <div className="hero-ctas">
            <BookDemoButton className="btn-primary hover-lift">{f.heroPrimaryButton}</BookDemoButton>
            <a className="btn-ghost hover-lift" href="#product">
              {f.heroSecondaryButton}
            </a>
          </div>
          <div className="built-for">
            <b>Built for</b> {f.heroBuiltForLine}
          </div>

          {f.loopEyebrow && <p className="loop-eyebrow" style={{ marginTop: 56 }}>{f.loopEyebrow}</p>}
          <div className="loop-stages">
            {loopStages.map((stage, i) => (
              <Reveal key={stage.label} delay={i * 90}>
                <div className="loop-stage">
                  <div className="loop-stage-label">{stage.label}</div>
                  <div className="loop-stage-card hover-lift">
                    <StageFragment stage={stage.label} />
                    <div>
                      <div className="loop-stage-title">{stage.title}</div>
                      <div className="loop-stage-body">{stage.body}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="narrative" id="product">
        <div className="wrap">
          <Reveal className="narrative-head">
            <h2>{f.narrativeHeadline}</h2>
            <p>{f.narrativeSubhead}</p>
          </Reveal>
          <div className="flow">
            {steps.map((step, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="flow-step">
                  <div className="flow-num">{step.label}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="fork" id="two-products">
        <div className="wrap">
          <Reveal className="narrative-head">
            <h2>{f.heroTwoProductsHeadline}</h2>
            <p>{f.heroTwoProductsBody}</p>
          </Reveal>
          <div className="fork-grid">
            <Reveal>
              <div className="fork-card light hover-lift">
                <div className="fork-eyebrow">{f.heroTwoProductsCxLabel}</div>
                <h2>{f.heroTwoProductsCxHeading || "Customer Experience"}</h2>
                <p>{f.heroTwoProductsCxBody}</p>
                <a href="/product" className="fork-cta">
                  {f.heroTwoProductsCxCta || "Explore Customer Experience →"}
                </a>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="fork-card dark hover-lift">
                <div className="fork-eyebrow">{f.heroTwoProductsCeLabel}</div>
                <h2>{f.heroTwoProductsCeHeading || "Colleague Pulse"}</h2>
                <p>{f.heroTwoProductsCeBody}</p>
                <a href="/colleague-pulse" className="fork-cta">
                  {f.heroTwoProductsCeCta || "Explore Colleague Pulse →"}
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="scale" id="solutions">
        <div className="wrap">
          <Reveal className="scale-head">
            <h2>{f.scaleHeadline}</h2>
            <p>{f.scaleSubhead}</p>
          </Reveal>
          <Reveal>
            <div className="scale-grid">
              <div className="scale-panel hover-lift">
                <div className="scale-tag">{f.scalePanel1Tag}</div>
                <h3>{f.scalePanel1Title || "Everything in one view"}</h3>
                <p>
                  {f.scalePanel1Body ||
                    "Every response, every trend, every flagged issue — one dashboard, no setup required beyond your QR code."}
                </p>
                <div className="scale-mini">
                  {(splitChips(f.scalePanel1Chips).length > 0
                    ? splitChips(f.scalePanel1Chips)
                    : ["Feedback points", "AI Insights", "Alert rules"]
                  ).map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </div>
              </div>
              <div className="scale-panel dark hover-lift">
                <div className="scale-tag">{f.scalePanel2Tag}</div>
                <h3>{f.scalePanel2Title || "Compare every branch, act across all of them"}</h3>
                <p>
                  {f.scalePanel2Body ||
                    "Regional rollups, branch-vs-branch comparison, and shared Case Management so nothing falls through the cracks between locations."}
                </p>
                <div className="scale-mini">
                  {(splitChips(f.scalePanel2Chips).length > 0
                    ? splitChips(f.scalePanel2Chips)
                    : ["Regional benchmarks", "Shared playbooks", "Role-based access"]
                  ).map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="pulse-section" id="cx-pulse">
        <div className="wrap pulse-grid">
          <Reveal>
            <div className="pulse-tag">CX Pulse</div>
            <h2>{f.cxPulseHeadline}</h2>
            <p>
              {f.cxPulseBody ||
                "CX Pulse measures whether feedback is actually shaping decisions — awareness, response speed, ownership, culture, and measured outcomes, rolled into one score your whole team can rally around."}
            </p>
            <BookDemoButton className="btn-ghost on-dark hover-lift">{f.cxPulseButton || "See CX Pulse in a demo"}</BookDemoButton>
          </Reveal>
          <Reveal delay={100}>
            <div className="levels">
              {levels.map((lvl, i) => (
                <div className={`level-row ${lvl.level === "3" ? "active" : ""}`} key={i}>
                  <div className="level-num">{lvl.level}</div>
                  <div className="level-name">{lvl.name}</div>
                  <div className="level-desc">{lvl.desc}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="why" id="company">
        <div className="wrap">
          <Reveal className="narrative-head">
            <h2>{f.whyHeadline || "Why teams choose OodelCX"}</h2>
          </Reveal>
          <div className="why-grid">
            {whyItems.map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="why-item">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta" id="demo">
        <div className="wrap">
          <h2>{f.finalCtaHeadline || "See what your customers are already telling you."}</h2>
          <p>{f.finalCtaSubhead || "Twenty minutes, a live walkthrough of real workflows — not a canned script."}</p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <BookDemoButton className="btn-primary hover-lift">{f.finalCtaPrimaryButton || "Book a demo"}</BookDemoButton>
            <a className="btn-ghost hover-lift" href="/login">
              {f.finalCtaSecondaryButton || "Sign in"}
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
