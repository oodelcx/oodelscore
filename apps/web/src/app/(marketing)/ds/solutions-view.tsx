"use client";

import { useState } from "react";
import Link from "next/link";
import type { IndustryDetail } from "@/lib/industries";
import { BookDemoButton } from "../demo-modal";
import { Icon, IndustryTiles } from "./industry-tiles";

type Labels = Record<string, string | undefined>;

/** The Solutions page: pick an industry, flip between Customer X and Colleague X. All copy is Site Content. */
export function SolutionsView({
  industries,
  labels,
  initialSlug,
  ctaHeadline,
  ctaSub,
}: {
  industries: IndustryDetail[];
  labels: Labels;
  initialSlug?: string;
  ctaHeadline?: string;
  ctaSub?: string;
}) {
  const [slug, setSlug] = useState(industries.find((i) => i.slug === initialSlug)?.slug ?? industries[0]?.slug ?? "");
  const [product, setProduct] = useState<"cx" | "ex">("cx");
  const ind = industries.find((i) => i.slug === slug);
  if (!ind) return null;
  const ex = product === "ex";
  const headline = ex ? ind.exHeadline : ind.cxHeadline;
  const sub = ex ? ind.exSub : ind.cxSub;
  const uses = (ex ? ind.exUses : ind.cxUses) ?? [];
  const challenge = ex ? ind.exChallenge : ind.cxChallenge;
  const measures = (ex ? ind.exMeasures : ind.cxMeasures) ?? [];
  const scene = ex ? ind.exScene : ind.cxScene;
  const steps = (ex ? ind.exSteps : ind.cxSteps) ?? [];

  function pick(next: string) {
    setSlug(next);
    try {
      window.history.replaceState(null, "", `/solutions/${next}`);
    } catch {
      // History API unavailable (embedded preview) — the switch still works in-page.
    }
  }

  return (
    <div className="ds-root">
      <section className="ds-ph-hero neu">
        <div className="ds-wrap">
          <div className="ds-sol-top">
            <div className="ds-eyebrow">{labels.eyebrow}</div>
            <div className="ds-seg" role="tablist" aria-label={labels.eyebrow}>
              {industries.map((i) => (
                <button key={i.slug} type="button" className={i.slug === slug ? "on" : ""} onClick={() => pick(i.slug)}>
                  {i.name}
                </button>
              ))}
            </div>
            <div className="ds-seg">
              <button type="button" className={!ex ? "on" : ""} onClick={() => setProduct("cx")}>
                {labels.productCxLabel}
              </button>
              <button type="button" className={ex ? "on" : ""} onClick={() => setProduct("ex")}>
                {labels.productExLabel}
              </button>
            </div>
          </div>
          <div className="ds-sol-grid">
            <div>
              <h1 className="ds-h1">{headline}</h1>
              <p className="ds-lead" style={{ marginTop: 16 }}>
                {sub}
              </p>
              <div className="ds-row" style={{ marginTop: 26 }}>
                <BookDemoButton className="ds-btn ds-btn-p">{labels.primaryButton}</BookDemoButton>
                <Link className="ds-btn ds-btn-g" href={ex ? "/colleague-x" : "/customer-x"}>
                  {ex ? labels.secondaryButtonEx : labels.secondaryButtonCx}
                </Link>
              </div>
            </div>
            <div className="ds-note ds-big-note">
              <div className="ds-eyebrow">{labels.sceneEyebrow}</div>
              <b>{scene}</b>
              <div className="ds-flow">
                {steps.map((t, i) => (
                  <div className="ds-flow-s" key={i}>
                    <i>{i + 1}</i>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
              {labels.sceneNote && <p>{labels.sceneNote}</p>}
            </div>
          </div>
        </div>
      </section>

      {(challenge || measures.length > 0) && (
        <section className="ds-sec">
          <div className="ds-wrap ds-sol-challenge">
            <div>
              <div className="ds-eyebrow">{labels.challengeLabel}</div>
              <p>{challenge}</p>
            </div>
            {measures.length > 0 && (
              <div>
                <div className="ds-eyebrow">{labels.measuresLabel}</div>
                <div className="ds-measure-list">
                  {measures.map((m, i) => (
                    <span key={i}>{m}</span>
                  ))}
                </div>
                {labels.measuresNote && <p className="ds-measure-note">{labels.measuresNote}</p>}
              </div>
            )}
          </div>
        </section>
      )}

      {uses.length > 0 && (
        <section className="ds-sec ds-band-alt">
          <div className="ds-wrap">
            <div className="ds-eyebrow">{labels.usesLabel}</div>
            <div className="ds-uses-grid">
              {uses.map((u, i) => (
                <div className="ds-use" key={i}>
                  <Icon name={u.icon} />
                  <div>
                    <b>{u.title}</b>
                    <p>{u.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="ds-sec">
        <div className="ds-wrap">
          <div className="ds-loop-head">
            <div>
              <div className="ds-eyebrow">{labels.otherEyebrow}</div>
              <h2 className="ds-h2" style={{ marginTop: 10 }}>
                {labels.otherHeadline}
              </h2>
            </div>
          </div>
          <IndustryTiles industries={industries} />
        </div>
      </section>

      {(ctaHeadline || ctaSub) && (
        <section className="ds-band-night ds-cta-band">
          <div className="ds-wrap">
            <h2 className="ds-h2" style={{ maxWidth: "20ch", marginInline: "auto" }}>
              {ctaHeadline}
            </h2>
            <p className="ds-lead">{ctaSub}</p>
            <div className="ds-row">
              <BookDemoButton className="ds-btn ds-btn-p">{labels.primaryButton}</BookDemoButton>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
