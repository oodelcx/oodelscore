import type { Metadata } from "next";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "./nav-footer";
import { HeroVisual } from "./hero-visual";
import { BookDemoButton } from "./demo-modal";

interface NarrativeStep {
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
    openGraph: { title, description, url: "/" },
    twitter: { title, description },
  };
}

export default async function MarketingHomePage() {
  const [menu, home] = await Promise.all([getSiteContent("menu"), getSiteContent("home")]);
  const f = home.fields;
  const steps = parseJsonArray<NarrativeStep>(f.narrativeSteps);
  const levels = parseJsonArray<CxLevel>(f.cxPulseLevels);
  const whyItems = parseJsonArray<TitleBodyItem>(f.whyItems);

  return (
    <>
      <MarketingNav active="home" navItems={menu.navItems} />

      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1>{f.heroHeadline}</h1>
            <p>{f.heroSubheadline}</p>
            <div className="hero-ctas">
              <BookDemoButton className="btn-primary">{f.heroPrimaryButton}</BookDemoButton>
              <a className="btn-ghost" href="#product">
                {f.heroSecondaryButton}
              </a>
            </div>
            <div className="built-for">
              <b>Built for</b> {f.heroBuiltForLine}
            </div>
          </div>
          <HeroVisual intervalSeconds={Number(f.heroCarouselIntervalSeconds) || 3} />
        </div>
      </section>

      <section className="narrative" id="product">
        <div className="wrap">
          <div className="narrative-head">
            <h2>{f.narrativeHeadline}</h2>
            <p>{f.narrativeSubhead}</p>
          </div>
          <div className="flow">
            {steps.map((step, i) => (
              <div className="flow-step" key={i}>
                <div className="flow-num">{step.label}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="scale" id="solutions">
        <div className="wrap">
          <div className="scale-head">
            <h2>{f.scaleHeadline}</h2>
            <p>{f.scaleSubhead}</p>
          </div>
          <div className="scale-grid">
            <div className="scale-panel">
              <div className="scale-tag">{f.scalePanel1Tag}</div>
              <h3>Everything in one view</h3>
              <p>Every response, every trend, every flagged issue — one dashboard, no setup required beyond your QR code.</p>
              <div className="scale-mini">
                <span>Feedback points</span>
                <span>AI insights</span>
                <span>Alert rules</span>
              </div>
            </div>
            <div className="scale-panel dark">
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
        </div>
      </section>

      <section className="pulse-section" id="cx-pulse">
        <div className="wrap pulse-grid">
          <div>
            <div className="pulse-tag">CX Pulse</div>
            <h2>{f.cxPulseHeadline}</h2>
            <p>
              CX Pulse measures whether feedback is actually shaping decisions — awareness, response speed, ownership, culture, and
              measured outcomes, rolled into one score your whole team can rally around.
            </p>
            <BookDemoButton className="btn-ghost on-dark">See CX Pulse in a demo</BookDemoButton>
          </div>
          <div className="levels">
            {levels.map((lvl, i) => (
              <div className={`level-row ${lvl.level === "3" ? "active" : ""}`} key={i}>
                <div className="level-num">{lvl.level}</div>
                <div className="level-name">{lvl.name}</div>
                <div className="level-desc">{lvl.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="why" id="company">
        <div className="wrap">
          <div className="narrative-head">
            <h2>Why teams choose OodelCX</h2>
          </div>
          <div className="why-grid">
            {whyItems.map((item, i) => (
              <div className="why-item" key={i}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta" id="demo">
        <div className="wrap">
          <h2>See what your customers are already telling you.</h2>
          <p>Twenty minutes, your own data — no generic demo script.</p>
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
