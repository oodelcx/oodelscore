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
interface CxLevel {
  level: string;
  name: string;
  desc: string;
}
interface TitleBodyItem {
  title: string;
  body: string;
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
  if (stage === "Listen") {
    return (
      <div className="loop-frag-bubble">
        &ldquo;Wait time was a bit long today&rdquo;
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-3)" }}>via QR · 42s ago</div>
      </div>
    );
  }
  if (stage === "Understand") {
    return (
      <div className="loop-frag-tags">
        <span className="loop-frag-tag">Wait time · 14</span>
        <span className="loop-frag-tag">Cleanliness · 6</span>
        <span className="loop-frag-tag">Staff · 3</span>
      </div>
    );
  }
  if (stage === "Act") {
    return (
      <div className="loop-frag-action">
        <span className="dot" />
        <span style={{ flex: 1 }}>Wait time flagged — Downtown</span>
        <span style={{ color: "var(--text-3)" }}>Sam · Fri</span>
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
  const loopStages = parseJsonArray<LoopStage>(f.loopStages);
  const steps = parseJsonArray<NarrativeStep>(f.narrativeSteps);
  const levels = parseJsonArray<CxLevel>(f.cxPulseLevels);
  const whyItems = parseJsonArray<TitleBodyItem>(f.whyItems);

  return (
    <>
      <MarketingNav active="home" navItems={menu.navItems} />

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
                <h3>Everything in one view</h3>
                <p>Every response, every trend, every flagged issue — one dashboard, no setup required beyond your QR code.</p>
                <div className="scale-mini">
                  <span>Feedback points</span>
                  <span>OCX Intelligence</span>
                  <span>Alert rules</span>
                </div>
              </div>
              <div className="scale-panel dark hover-lift">
                <div className="scale-tag">{f.scalePanel2Tag}</div>
                <h3>Compare every branch, act across all of them</h3>
                <p>Regional rollups, branch-vs-branch comparison, and a shared Action Board so nothing falls through the cracks between locations.</p>
                <div className="scale-mini">
                  <span>Regional benchmarks</span>
                  <span>Shared playbooks</span>
                  <span>Role-based access</span>
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
              CX Pulse measures whether feedback is actually shaping decisions — awareness, response speed, ownership, culture, and
              measured outcomes, rolled into one score your whole team can rally around.
            </p>
            <BookDemoButton className="btn-ghost on-dark hover-lift">See CX Pulse in a demo</BookDemoButton>
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
            <h2>Why teams choose OodelCX</h2>
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
          <h2>See what your customers are already telling you.</h2>
          <p>Twenty minutes, your own data — no generic demo script.</p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <BookDemoButton className="btn-primary hover-lift">Book a demo</BookDemoButton>
            <a className="btn-ghost hover-lift" href="/login">
              Sign in
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter fields={menu.fields} />
    </>
  );
}
