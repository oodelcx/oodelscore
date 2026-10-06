"use client";

import { useState } from "react";
import { BookDemoButton } from "../demo-modal";

export interface Plan {
  product?: string;
  name: string;
  price: string;
  priceNote: string;
  featured?: boolean;
  cta: string;
  features: string[];
}

type Labels = Record<string, string | undefined>;

/** Plans for one product at a time (a toggle), so neither price list buries the other. */
export function PricingView({ plans, loopItems, labels }: { plans: Plan[]; loopItems: { label: string; body: string }[]; labels: Labels }) {
  const [product, setProduct] = useState<"customer_experience" | "colleague_experience">("customer_experience");
  const ex = product === "colleague_experience";
  const shown = plans.filter((p) => (p.product ?? "customer_experience") === product);
  const hasEx = plans.some((p) => p.product === "colleague_experience");

  return (
    <div className={`ds-root${ex ? " ds-theme-ex" : ""}`}>
      <section className={`ds-ph-hero ${ex ? "ex" : "cx"}`}>
        <div className="ds-wrap">
          <div className="ds-eyebrow">{labels.pricingEyebrow}</div>
          <h1 className="ds-h1" style={{ margin: "12px 0 16px", maxWidth: "18ch" }}>
            {labels.heroHeadline}
          </h1>
          <p className="ds-lead">{labels.heroSubhead}</p>
          {hasEx && (
            <div className="ds-seg" style={{ marginTop: 24 }}>
              <button type="button" className={!ex ? "on" : ""} onClick={() => setProduct("customer_experience")}>
                {labels.cxPlansHeading}
              </button>
              <button type="button" className={ex ? "on" : ""} onClick={() => setProduct("colleague_experience")}>
                {labels.cePlansHeading}
              </button>
            </div>
          )}
          {ex && labels.cePlansSubhead && (
            <p className="ds-lead" style={{ marginTop: 16, fontSize: 15 }}>
              {labels.cePlansSubhead}
            </p>
          )}
        </div>
      </section>

      <section className="ds-sec-tight">
        <div className="ds-wrap">
          <div className="ds-plans">
            {shown.map((plan, i) => (
              <div className={`ds-plan${plan.featured ? " ds-feat-p" : ""}`} key={i}>
                <h3>{plan.name}</h3>
                <div className="ds-price">
                  {plan.price}
                  <small>{plan.priceNote}</small>
                </div>
                <ul>
                  {plan.features.map((feat, j) => (
                    <li key={j}>{feat}</li>
                  ))}
                </ul>
                {/* Every plan CTA opens the demo modal — self-serve signup doesn't exist yet. */}
                <BookDemoButton className="ds-btn">{plan.cta}</BookDemoButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ds-sec ds-band-alt">
        <div className="ds-wrap">
          {loopItems.length > 0 && (
            <>
              <h2 className="ds-h2" style={{ maxWidth: "22ch", marginBottom: 20 }}>
                {labels.loopStripHeadline}
              </h2>
              <div className="ds-strip">
                {loopItems.map((item, i) => (
                  <div key={i}>
                    <b>{item.label}</b>
                    {item.body}
                  </div>
                ))}
              </div>
            </>
          )}
          {labels.enterpriseNote && (
            <p className="ds-lead" style={{ marginTop: 22 }}>
              {labels.enterpriseNote}{" "}
              <BookDemoButton className="ds-link-btn">{labels.enterpriseLinkLabel}</BookDemoButton>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
