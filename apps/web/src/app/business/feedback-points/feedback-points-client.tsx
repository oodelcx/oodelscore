"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { QrModal } from "@/components/qr-modal";
import { InfoTip } from "@/components/info-tip";
import { useTooltips } from "@/lib/useTooltips";
import { SurveyBuilderPanel, type SurveyBuilderPayload } from "@/components/survey-builder";
import { FeedbackPointExpiry } from "@/components/feedback-point-expiry";

interface DemographicConfig {
  name: string;
  email: string;
  phone: string;
  ageGroup: string;
  gender: string;
}

interface FeedbackPointRow {
  _id: string;
  name: string;
  description: string;
  qrToken: string;
  scans: number;
  active: boolean;
  isDraft?: boolean;
  product?: "customer_experience" | "colleague_experience";
  hasNps: boolean;
  hasComments: boolean;
  demographics: DemographicConfig;
  templateName: string;
  isTemplateOverridden: boolean;
  effectiveFormLayout: "single_page" | "one_per_screen";
  isLayoutOverridden: boolean;
  eventName: string | null;
  deliveryMode?: "qr" | "link" | "both";
  endsAt: string | null;
}

const LAYOUT_LABELS: Record<string, string> = {
  single_page: "All questions on one screen",
  one_per_screen: "One question per screen",
};

const DEMOGRAPHIC_LABELS: Record<keyof DemographicConfig, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  ageGroup: "Age",
  gender: "Gender",
};

function configBadges(p: FeedbackPointRow) {
  const badges: { label: string; className: string }[] = [
    { label: p.hasNps ? "NPS on" : "NPS off", className: p.hasNps ? "pill-accent" : "pill-gray" },
    { label: p.hasComments ? "Comments on" : "Comments off", className: p.hasComments ? "pill-accent" : "pill-gray" },
  ];
  const demoEntries = (Object.keys(DEMOGRAPHIC_LABELS) as (keyof DemographicConfig)[]).filter(
    (key) => (p.demographics?.[key] ?? "off") !== "off"
  );
  if (demoEntries.length === 0) {
    badges.push({ label: "All demographics off", className: "pill-gray" });
  } else {
    for (const key of demoEntries) {
      const mode = p.demographics[key];
      badges.push({
        label: `${DEMOGRAPHIC_LABELS[key]} ${mode}`,
        className: mode === "mandatory" ? "pill-green" : "pill-amber",
      });
    }
  }
  return badges;
}

export default function FeedbackPointsClient() {
  const tooltips = useTooltips("feedback-points");
  const [points, setPoints] = useState<FeedbackPointRow[]>([]);
  const [isBranch, setIsBranch] = useState(false);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [requestSent, setRequestSent] = useState(false);
  const [qrPoint, setQrPoint] = useState<FeedbackPointRow | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderSubmitting, setBuilderSubmitting] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [cxEnabled, setCxEnabled] = useState(true);
  const [ceEnabled, setCeEnabled] = useState(false);
  const [viewProduct, setViewProduct] = useState<"customer_experience" | "colleague_experience" | null>(null);

  function openBuilder() {
    setBuilderError(null);
    setBuilderOpen(true);
  }

  function pointStatus(p: FeedbackPointRow): "draft" | "live" | "closed" {
    if (p.isDraft) return "draft";
    if (!p.active) return "closed";
    if (p.endsAt && new Date(p.endsAt) < new Date()) return "closed";
    return "live";
  }

  async function pointAction(id: string, action: "publish" | "close" | "reopen") {
    const res = await fetch(`/api/business/feedback-points/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.status !== "ok") {
      alert(data?.message ?? "That change could not be saved.");
      return;
    }
    const fp = data.feedbackPoint;
    setPoints((prev) => prev.map((pt) => (pt._id === id ? { ...pt, active: fp.active, isDraft: fp.isDraft, endsAt: fp.endsAt } : pt)));
  }

  async function submitBuilder(payload: SurveyBuilderPayload) {
    setBuilderError(null);
    setBuilderSubmitting(true);
    try {
      const res = await fetch("/api/business/feedback-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          description: payload.description,
          product: payload.product,
          responseQuota: payload.responseQuota,
          questions: payload.questions,
          deliveryMode: payload.deliveryMode,
          demographicOverride: payload.demographicOverride,
          isDraft: payload.isDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "ok") {
        throw new Error(data.message || "Couldn't create this feedback point. Please try again.");
      }
      setBuilderOpen(false);
      const pointsRes = await fetch("/api/business/feedback-points").then((r) => r.json());
      setPoints(pointsRes.feedbackPoints ?? []);
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : "Couldn't create this feedback point. Please try again.");
    } finally {
      setBuilderSubmitting(false);
    }
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/business/feedback-points").then((r) => r.json()),
      fetch("/api/business/responses").then((r) => r.json()),
    ]).then(([pointsData, responsesData]) => {
      setPoints(pointsData.feedbackPoints ?? []);
      setIsBranch(!!pointsData.isBranch);
      const counts: Record<string, number> = {};
      for (const r of responsesData.responses ?? []) {
        counts[r.feedbackPointId] = (counts[r.feedbackPointId] ?? 0) + 1;
      }
      setResponseCounts(counts);
      setLoading(false);
    });
    fetch("/api/business/me")
      .then((r) => r.json())
      .then((d) => {
        const products: string[] = d.business?.enabledProducts ?? ["customer_experience"];
        setCxEnabled(products.includes("customer_experience"));
        setCeEnabled(products.includes("colleague_experience"));
        setViewProduct(d.viewProduct ?? null);
      });
  }, []);

  function openRequest() {
    setRequestError(null);
    setRequestOpen(true);
  }

  async function submitRequest() {
    setRequestSubmitting(true);
    setRequestError(null);
    try {
      const res = await fetch("/api/business/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "feedback_point_request",
          subject: "Feedback point request",
          body: requestNote.trim() || "(no note given)",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "ok") {
        throw new Error(data.message || "Couldn't send your request. Please try again.");
      }
      setRequestOpen(false);
      setRequestNote("");
      setRequestSent(true);
      setTimeout(() => setRequestSent(false), 4000);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Couldn't send your request. Please try again.");
    } finally {
      setRequestSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Feedback points</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            View your QR codes and what each one asks customers.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!loading && !isBranch && (
            <button className="btn btn-dark" onClick={openBuilder}>
              + Build a survey
            </button>
          )}
          <button className="btn" data-tour="fp-request-button" onClick={openRequest}>
            + Request new feedback point
          </button>
          <InfoTip text={tooltips["request-feedback-point"]} />
        </div>
      </div>

      {!loading && (
        <div className="callout">
          {isBranch ? (
            <>
              Your parent organization builds and manages this branch's surveys centrally, so every branch stays
              consistent — your Group owner does this from their own Feedback Points page. For anything else, request
              a change below — your account manager actions those within one business day.
            </>
          ) : (
            <>
              Build your own feedback point above — write your own questions, pick a type for each (star rating, NPS,
              multiple choice, and more), and optionally start from one of OodelCX's ready-made templates as an
              editable first draft. For anything else, request a change below — your account manager actions those
              within one business day.
            </>
          )}
        </div>
      )}
      {requestSent && <div className="callout">Your request has been sent — your account manager will be in touch.</div>}

      {builderOpen && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Build a survey</h3>
          <SurveyBuilderPanel
            templatesApiPath="/api/business/feedback-points/templates"
            categoriesApiPath="/api/business/category-owners"
            cxEnabled={cxEnabled}
            ceEnabled={ceEnabled}
            lockedProduct={viewProduct}
            submitting={builderSubmitting}
            error={builderError}
            onCancel={() => setBuilderOpen(false)}
            onSubmit={submitBuilder}
          />
        </div>
      )}

      {requestOpen && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>
            Request a feedback point <InfoTip text={tooltips["request-feedback-point"]} />
          </h3>
          <p className="card-sub">
            Tell your account manager what you need — a new location, an updated question set, anything else.
          </p>
          <textarea
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="Optional note (e.g. which location, what should change)"
            rows={3}
            style={{ width: "100%", marginTop: 8, marginBottom: 8 }}
          />
          {requestError && <p style={{ color: "var(--danger, #c0392b)" }}>{requestError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-dark" onClick={submitRequest} disabled={requestSubmitting}>
              {requestSubmitting ? "Sending…" : "Send request"}
            </button>
            <button
              className="btn"
              onClick={() => {
                setRequestOpen(false);
                setRequestError(null);
              }}
              disabled={requestSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <div className="grid grid-2">
          {points
            .filter((p) => !viewProduct || !p.product || p.product === viewProduct)
            .map((p, index) => {
            const responses = responseCounts[p._id] ?? 0;
            const conversion = p.scans > 0 ? Math.round((responses / p.scans) * 100) : null;
            const isFirst = index === 0;
            return (
              <div
                className="fp-card"
                data-tour={isFirst ? "fp-first-card" : undefined}
                key={p._id}
                style={{ "--fp-accent": p.active ? "var(--accent)" : "var(--text-3)" } as CSSProperties}
              >
                <h3>{p.name}</h3>
                <p className="card-sub">{p.description || "—"}</p>
                <div style={{ display: "flex", gap: 18, fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
                  <div>
                    {p.scans} scans <InfoTip text={tooltips["scans"]} />
                  </div>
                  <div>
                    <a href={`/business/responses?filter=${p._id}`}>{responses} responses</a> <InfoTip text={tooltips["responses"]} />
                  </div>
                  <div>
                    <strong style={{ color: "var(--text)" }}>{conversion !== null ? `${conversion}%` : "—"}</strong> conversion{" "}
                    <InfoTip text={tooltips["conversion"]} />
                  </div>
                </div>
                <div className="badge-row">
                  <span className={`pill ${pointStatus(p) === "live" ? "pill-accent" : pointStatus(p) === "draft" ? "pill-amber" : "pill-gray"}`}>
                    {pointStatus(p) === "live" ? "Live" : pointStatus(p) === "draft" ? "Draft: not collecting yet" : "Closed"}
                  </span>
                  <InfoTip text={tooltips["active-status"]} />
                  {p.eventName && <span className="pill pill-amber">Session: {p.eventName}</span>}
                  {configBadges(p).map((b, i) => (
                    <span className={`pill ${b.className}`} key={i}>
                      {b.label}
                    </span>
                  ))}
                </div>
                <div className="card-sub" style={{ marginTop: 10 }}>
                  <div>
                    <b>Questions:</b> {p.templateName}
                    {p.isTemplateOverridden && " (custom for this point)"}
                  </div>
                  <div>
                    <b>Layout:</b> {LAYOUT_LABELS[p.effectiveFormLayout] ?? p.effectiveFormLayout}
                    {p.isLayoutOverridden && " (custom for this point)"}
                  </div>
                </div>
                {!isBranch && (
                  <FeedbackPointExpiry
                    apiPath={`/api/business/feedback-points/${p._id}`}
                    endsAt={p.endsAt}
                    onUpdated={(endsAt) => setPoints((prev) => prev.map((pt) => (pt._id === p._id ? { ...pt, endsAt } : pt)))}
                  />
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  <a className="btn btn-dark" style={{ flex: 1, textAlign: "center" }} href={`/business/responses?filter=${p._id}`}>
                    View responses
                  </a>
                  {!isBranch && pointStatus(p) === "draft" && (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => pointAction(p._id, "publish")}>
                      Publish
                    </button>
                  )}
                  {!isBranch && pointStatus(p) === "live" && (
                    <button className="btn" style={{ flex: 1 }} onClick={() => pointAction(p._id, "close")}>
                      Close
                    </button>
                  )}
                  {!isBranch && pointStatus(p) === "closed" && (
                    <button className="btn" style={{ flex: 1 }} onClick={() => pointAction(p._id, "reopen")}>
                      Reopen
                    </button>
                  )}
                  {p.deliveryMode !== "link" && (
                    <button className="btn" data-tour={isFirst ? "fp-first-qr" : undefined} style={{ flex: 1 }} onClick={() => setQrPoint(p)}>
                      View QR
                    </button>
                  )}
                  <button className="btn" style={{ flex: 1 }} onClick={openRequest}>
                    Request changes
                  </button>
                </div>
                {p.deliveryMode === "link" && (
                  <p className="subtitle" style={{ marginTop: 8, marginBottom: 0 }}>
                    Link-only — share <code>{typeof window !== "undefined" ? window.location.origin : ""}/feedback/{p.qrToken}</code>, no QR/poster for this one.
                  </p>
                )}
              </div>
            );
          })}
          {points.filter((p) => !viewProduct || !p.product || p.product === viewProduct).length === 0 && (
            <p className="subtitle">No feedback points yet — request one above.</p>
          )}
        </div>
      )}

      {qrPoint && (
        <QrModal
          name={qrPoint.name}
          qrToken={qrPoint.qrToken}
          posterHref={`/print/business-feedback-point/${qrPoint._id}`}
          onClose={() => setQrPoint(null)}
        />
      )}
    </div>
  );
}
