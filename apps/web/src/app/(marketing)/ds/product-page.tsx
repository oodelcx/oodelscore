import { notFound } from "next/navigation";
import { defaultStageForFeature } from "@oodelscore/shared";
import { getSiteContent } from "@/lib/siteContent";
import { visibleIndustries, type IndustryDetail } from "@/lib/industries";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { BookDemoButton } from "../demo-modal";
import { ChapterRail } from "./chapter-rail";
import { IndustryTiles } from "./industry-tiles";
import { StageVisual, DashVisual, RouteDiagram } from "./visuals";
import { fill, list, readViz, STAGE_IDS, type Feature, type StageDef } from "./content";

/**
 * One layout for both products: hero, a Capture -> Confirm chapter per C with
 * that C's features and its illustration, an "always on" strip, industries and
 * a closing call to action. Customer X and Colleague X differ only in their
 * content (and the amber accent on Colleague X).
 */
export async function ProductPage({ page }: { page: "customer-x" | "colleague-x" }) {
  const [menu, content, solutions] = await Promise.all([getSiteContent("menu"), getSiteContent(page), getSiteContent("solutions")]);
  if (menu.navItems.find((n) => n.key === page)?.visible === false) notFound();
  const f = content.fields;
  const ex = page === "colleague-x";
  const v = readViz(f);
  const features = list<Feature>(f.features);
  const stageDefs = list<StageDef>(f.stageDefs);
  const chips = list<string>(f.heroChips);
  const industries: IndustryDetail[] = visibleIndustries(solutions.fields.industryDetails);
  const other = ex ? "colleague-x" : "customer-x";
  void other;

  const byStage = (id: string) => features.filter((x) => (x.stage ?? defaultStageForFeature(x)) === id);
  const noStage = features.filter((x) => (x.stage ?? defaultStageForFeature(x)) === "none");
  const railItems = STAGE_IDS.map((id, i) => ({ id, label: stageDefs[i]?.label ?? id }));

  return (
    <>
      <MarketingNav active={page} navItems={menu.navItems} headerStyle={menu.fields.headerStyle} navLabels={menu.fields} />
      <div className={`ds-root${ex ? " ds-theme-ex" : ""}`}>
        <section className={`ds-ph-hero ${ex ? "ex" : "cx"}`}>
          <div className="ds-wrap ds-ph-grid">
            <div>
              <div className="ds-eyebrow">{f.heroEyebrow}</div>
              <h1 className="ds-h1" style={{ marginTop: 12 }}>
                {f.heroHeadline}
              </h1>
              <p className="ds-lead">{f.heroSubheadline}</p>
              <div className="ds-row">
                <BookDemoButton className="ds-btn ds-btn-p">{f.heroPrimaryButton}</BookDemoButton>
                {f.heroSecondaryButton && (
                  <a className="ds-btn ds-btn-g" href={f.heroSecondaryHref || "#"}>
                    {f.heroSecondaryButton}
                  </a>
                )}
              </div>
              {chips.length > 0 && (
                <div className="ds-facts">
                  {chips.map((c, i) => (
                    <span key={i}>{c}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="ds-stage" style={{ position: "relative" }}>
              <div style={{ maxWidth: 470, marginInline: "auto", width: "100%" }}>
                {f.heroVisual === "route" ? <RouteDiagram v={v} /> : <DashVisual v={v} />}
              </div>
            </div>
          </div>
        </section>

        <ChapterRail items={railItems} note={f.railNote} />

        {STAGE_IDS.map((id, i) => {
          const def = stageDefs[i];
          const items = byStage(id);
          return (
            <section className="ds-chap" id={id} key={id}>
              <div className="ds-wrap ds-chap-grid">
                <div className="ds-txt">
                  <div className="ds-eyebrow">{fill(f.stepLabelFormat, { n: i + 1, total: STAGE_IDS.length })}</div>
                  <div className="ds-big" style={{ marginTop: 8 }}>
                    {def?.label ?? id}
                  </div>
                  <p className="ds-def">{def?.def}</p>
                  <div className="ds-feats">
                    {items.map((feat) => (
                      <div className="ds-feat" id={feat.tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")} key={feat.tag}>
                        <h4>
                          {feat.headline}
                          <small>{feat.tag}</small>
                        </h4>
                        <p>{feat.body}</p>
                      </div>
                    ))}
                  </div>
                  {i === STAGE_IDS.length - 1 && (f.alwaysOnText || noStage.length > 0) && (
                    <div className="ds-always">
                      <b>{f.alwaysOnLabel}</b>
                      <span>{f.alwaysOnText}</span>
                      {noStage.map((feat) => (
                        <span key={feat.tag}>
                          {feat.tag}: {feat.body}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="ds-vis-col">
                  <StageVisual stage={id} v={v} />
                </div>
              </div>
            </section>
          );
        })}

        {industries.length > 0 && (
          <section className="ds-sec ds-band-alt">
            <div className="ds-wrap">
              <div className="ds-loop-head">
                <div>
                  <div className="ds-eyebrow">{f.industriesEyebrow}</div>
                  <h2 className="ds-h2" style={{ marginTop: 10, maxWidth: "20ch" }}>
                    {f.industriesHeadline}
                  </h2>
                </div>
              </div>
              <IndustryTiles industries={industries} />
            </div>
          </section>
        )}

        <section className="ds-band-night ds-cta-band">
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
