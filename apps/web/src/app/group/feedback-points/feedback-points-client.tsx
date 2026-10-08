"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { QrModal } from "@/components/qr-modal";
import { SurveyBuilderPanel, type SurveyBuilderPayload } from "@/components/survey-builder";
import { FeedbackPointExpiry } from "@/components/feedback-point-expiry";

interface BranchOption {
  _id: string;
  name: string;
}
interface FeedbackPointRow {
  _id: string;
  businessId: string;
  businessName: string;
  name: string;
  description: string;
  qrToken: string;
  scans: number;
  active: boolean;
  isDraft?: boolean;
  responseQuota: number | null;
  product?: "customer_experience" | "colleague_experience";
  deliveryMode?: "qr" | "link" | "both";
  endsAt: string | null;
}

/**
 * Centralized survey building for a multi-branch org — the Group twin of
 * /business/feedback-points' builder, except a branch is picked first
 * rather than implied by whoever's logged in. Branches never get this
 * capability themselves (see the business route's own comment): the org
 * owner builds here, on behalf of whichever branch needs a new point, so
 * surveys stay consistent across the network instead of drifting branch by
 * branch. Same real question-authoring builder as the Business portal.
 */
export default function GroupFeedbackPointsClient() {
  const [points, setPoints] = useState<FeedbackPointRow[] | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [qrPoint, setQrPoint] = useState<FeedbackPointRow | null>(null);
  const [cxEnabled, setCxEnabled] = useState(true);
  const [ceEnabled, setCeEnabled] = useState(false);
  const [viewProduct, setViewProduct] = useState<"customer_experience" | "colleague_experience" | null>(null);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [businessId, setBusinessId] = useState("");
  const [builderSubmitting, setBuilderSubmitting] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

  function pointStatus(p: { active: boolean; isDraft?: boolean; endsAt: string | null }): "draft" | "live" | "closed" {
    if (p.isDraft) return "draft";
    if (!p.active) return "closed";
    if (p.endsAt && new Date(p.endsAt) < new Date()) return "closed";
    return "live";
  }

  async function pointAction(id: string, action: "publish" | "close" | "reopen") {
    const res = await fetch(`/api/group/feedback-points/${id}`, {
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
    setPoints((prev) => (prev ? prev.map((pt) => (pt._id === id ? { ...pt, active: fp.active, isDraft: fp.isDraft, endsAt: fp.endsAt } : pt)) : prev));
  }

  function load() {
    fetch("/api/group/feedback-points")
      .then((r) => r.json())
      .then((d) => {
        setPoints(d.feedbackPoints ?? []);
        setBranches(d.branches ?? []);
      });
  }

  useEffect(() => {
    load();
    fetch("/api/group/me")
      .then((r) => r.json())
      .then((d) => {
        const products: string[] = d.org?.enabledProducts ?? ["customer_experience"];
        setCxEnabled(products.includes("customer_experience"));
        setCeEnabled(products.includes("colleague_experience"));
        setViewProduct(d.viewProduct ?? null);
      });
  }, []);

  function openBuilder() {
    setBuilderError(null);
    setBuilderOpen(true);
    if (branches.length > 0 && !businessId) setBusinessId(branches[0]._id);
  }

  async function submitBuilder(payload: SurveyBuilderPayload) {
    setBuilderError(null);
    if (!businessId) {
      setBuilderError("Pick a branch");
      return;
    }
    setBuilderSubmitting(true);
    try {
      const res = await fetch("/api/group/feedback-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
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
      load();
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : "Couldn't create this feedback point. Please try again.");
    } finally {
      setBuilderSubmitting(false);
    }
  }

  if (points === null) return <p className="subtitle">Loading…</p>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Feedback points</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Build and manage every branch's surveys centrally — a branch never builds its own, so the whole network
            stays consistent.
          </p>
        </div>
        <button className="btn btn-dark" onClick={openBuilder} disabled={branches.length === 0}>
          + Build a survey
        </button>
      </div>

      {branches.length === 0 && <p className="subtitle">No branches yet — add a branch before building a survey.</p>}

      {builderOpen && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Build a survey</h3>
          <div className="field" style={{ maxWidth: 420, marginBottom: 8 }}>
            <label>Branch</label>
            <select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <SurveyBuilderPanel
            templatesApiPath="/api/group/feedback-points/templates"
            categoriesApiPath="/api/group/category-owners"
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

      {(() => {
        const visiblePoints = points.filter((p) => !viewProduct || !p.product || p.product === viewProduct);
        if (visiblePoints.length === 0) {
          return <p className="subtitle">No feedback points yet — build one above.</p>;
        }
        return (
          <div className="grid grid-2">
            {visiblePoints.map((p) => (
              <div
                className="fp-card"
                key={p._id}
                style={{ "--fp-accent": p.active ? "var(--accent)" : "var(--text-3)" } as CSSProperties}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <h3 style={{ margin: 0 }}>{p.name}</h3>
                  <span className={`pill ${pointStatus(p) === "live" ? "pill-accent" : pointStatus(p) === "draft" ? "pill-amber" : "pill-gray"}`}>
                    {pointStatus(p) === "live" ? "Live" : pointStatus(p) === "draft" ? "Draft: not collecting yet" : "Closed"}
                  </span>
                </div>
                <span className="pill pill-blue" style={{ marginTop: 6, display: "inline-block" }}>
                  {p.businessName}
                </span>
                {p.description && (
                  <p className="card-sub" style={{ marginTop: 8 }}>
                    {p.description}
                  </p>
                )}
                <div style={{ display: "flex", gap: 18, fontSize: 13, color: "var(--text-2)", margin: "10px 0 14px" }}>
                  <div>{p.scans} scans</div>
                  {p.responseQuota !== null && <div>quota {p.responseQuota}</div>}
                </div>
                <FeedbackPointExpiry
                  apiPath={`/api/group/feedback-points/${p._id}`}
                  endsAt={p.endsAt}
                  onUpdated={(endsAt) =>
                    setPoints((prev) => (prev ? prev.map((pt) => (pt._id === p._id ? { ...pt, endsAt } : pt)) : prev))
                  }
                />
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {pointStatus(p) === "draft" && (
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => pointAction(p._id, "publish")}>
                      Publish
                    </button>
                  )}
                  {pointStatus(p) === "live" && (
                    <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => pointAction(p._id, "close")}>
                      Close
                    </button>
                  )}
                  {pointStatus(p) === "closed" && (
                    <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => pointAction(p._id, "reopen")}>
                      Reopen
                    </button>
                  )}
                </div>
                {p.deliveryMode !== "link" ? (
                  <button className="btn btn-sm" style={{ width: "100%" }} onClick={() => setQrPoint(p)}>
                    View QR
                  </button>
                ) : (
                  <p className="subtitle" style={{ margin: 0 }}>
                    Link-only — no QR/poster for this one.
                  </p>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {qrPoint && (
        <QrModal
          name={`${qrPoint.businessName} — ${qrPoint.name}`}
          qrToken={qrPoint.qrToken}
          posterHref={`/print/group-branch-feedback-point/${qrPoint._id}`}
          onClose={() => setQrPoint(null)}
        />
      )}
    </div>
  );
}
