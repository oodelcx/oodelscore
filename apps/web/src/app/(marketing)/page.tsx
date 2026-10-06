import type { Metadata } from "next";
import Link from "next/link";
import { getSiteContent } from "@/lib/siteContent";
import { mergeIndustries } from "@/lib/industries";
import { MarketingNav, MarketingFooter } from "./nav-footer";
import { BookDemoButton } from "./demo-modal";
import { FiveCLoop } from "./ds/five-c-loop";
import { IndustryTiles } from "./ds/industry-tiles";
import { DashVisual, PhoneMock, StageVisual } from "./ds/visuals";
import { list, readViz, STAGE_IDS, strings } from "./ds/content";

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

interface LoopStage {
  label: string;
  title: string;
  body: string;
}

export default async function MarketingHomePage() {
  const [menu, home, cx, solutions] = await Promise.all([
    getSiteContent("menu"),
    getSiteContent("home"),
    getSiteContent("customer-x"),
    getSiteContent("solutions"),
  ]);
  const f = home.fields;
  // The stage illustrations on Home are the Customer X ones; their text is edited under Customer X.
  const v = readViz(cx.fields);
  const loopStages = list<LoopStage>(f.loopStages);
  const industries = mergeIndustries(solutions.fields.industryDetails);
  const builtFor = (f.heroBuiltForLine ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cxBullets = strings(f.doorCxBullets);
  const ceBullets = strings(f.doorCeBullets);

  return (
    <>
      <MarketingNav active="home" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} navLabels={menu.fields} />
      <div className="ds-root">
        <section className="ds-band-night ds-hero">
          <div className="ds-wrap ds-hero-grid">
            <div>
              <div className="ds-eyebrow">{f.heroEyebrow}</div>
              <h1 className="ds-h1" style={{ marginTop: 14 }}>
                {f.heroHeadline}
              </h1>
              <p className="ds-lead">{f.heroSubheadline}</p>
              <div className="ds-row">
                <BookDemoButton className="ds-btn ds-btn-p">{f.heroPrimaryButton}</BookDemoButton>
                {f.heroSecondaryButton && (
                  <a className="ds-btn ds-btn-g" href={f.heroSecondaryHref || "#loop"}>
                    {f.heroSecondaryButton}
                  </a>
                )}
              </div>
              {builtFor.length > 0 && (
                <div className="ds-trust" aria-label={f.heroBuiltForLabel}>
                  {builtFor.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="ds-hero-stage ds-stage" style={{ position: "relative" }}>
              <div style={{ maxWidth: 470, marginLeft: "auto" }}>
                <DashVisual v={v} />
              </div>
              <div className="ds-float" style={{ left: -6, bottom: -20, transform: "scale(.8)", transformOrigin: "bottom left" }}>
                <PhoneMock v={v.capture} />
              </div>
            </div>
          </div>
        </section>

        <section className="ds-sec" id="loop">
          <div className="ds-wrap">
            <div className="ds-loop-head">
              <div>
                <div className="ds-eyebrow">{f.loopEyebrow}</div>
                <h2 className="ds-h2" style={{ marginTop: 10, maxWidth: "18ch" }}>
                  {f.loopHeadline}
                </h2>
              </div>
              <p className="ds-lead" style={{ maxWidth: "40ch" }}>
                {f.loopSubhead}
              </p>
            </div>
            <FiveCLoop
              stages={loopStages}
              stepFormat={f.loopStepFormat || "{n} of {total} · {label}"}
              visuals={STAGE_IDS.map((id) => (
                <StageVisual key={id} stage={id} v={v} />
              ))}
            />
          </div>
        </section>

        <section className="ds-sec ds-band-alt" id="two-products">
          <div className="ds-wrap">
            <div className="ds-loop-head">
              <div>
                <div className="ds-eyebrow">{f.heroTwoProductsEyebrow}</div>
                <h2 className="ds-h2" style={{ marginTop: 10, maxWidth: "16ch" }}>
                  {f.heroTwoProductsHeadline}
                </h2>
              </div>
              <p className="ds-lead" style={{ maxWidth: "40ch" }}>
                {f.heroTwoProductsBody}
              </p>
            </div>
            <div className="ds-doors">
              <Link className="ds-door cx" href="/customer-x">
                <div className="ds-eyebrow">{f.heroTwoProductsCxLabel}</div>
                <h3>{f.heroTwoProductsCxHeading}</h3>
                <p className="ds-lead" style={{ color: "var(--ink)", opacity: 0.8 }}>
                  {f.heroTwoProductsCxBody}
                </p>
                <ul>
                  {cxBullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <span className="ds-btn ds-btn-dark" style={{ justifySelf: "start" }}>
                  {f.heroTwoProductsCxCta}
                </span>
              </Link>
              <Link className="ds-door ex" href="/colleague-x">
                <div className="ds-eyebrow">{f.heroTwoProductsCeLabel}</div>
                <h3>{f.heroTwoProductsCeHeading}</h3>
                <p className="ds-lead" style={{ color: "var(--ink)", opacity: 0.8 }}>
                  {f.heroTwoProductsCeBody}
                </p>
                <ul>
                  {ceBullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <span className="ds-btn ds-btn-dark" style={{ justifySelf: "start" }}>
                  {f.heroTwoProductsCeCta}
                </span>
              </Link>
            </div>
          </div>
        </section>

        {industries.length > 0 && (
          <section className="ds-sec">
            <div className="ds-wrap">
              <div className="ds-loop-head">
                <div>
                  <div className="ds-eyebrow">{f.industriesEyebrow}</div>
                  <h2 className="ds-h2" style={{ marginTop: 10 }}>
                    {f.industriesHeadline}
                  </h2>
                </div>
              </div>
              <IndustryTiles industries={industries} />
            </div>
          </section>
        )}

        <section className="ds-band-night ds-cta-band" id="demo">
          <div className="ds-wrap">
            <h2 className="ds-h2" style={{ maxWidth: "20ch", marginInline: "auto" }}>
              {f.finalCtaHeadline}
            </h2>
            <p className="ds-lead">{f.finalCtaSubhead}</p>
            <div className="ds-row">
              <BookDemoButton className="ds-btn ds-btn-p">{f.finalCtaPrimaryButton}</BookDemoButton>
              <a className="ds-btn ds-btn-g" href={f.finalCtaSecondaryHref || "/pricing"}>
                {f.finalCtaSecondaryButton}
              </a>
            </div>
          </div>
        </section>
      </div>
      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
