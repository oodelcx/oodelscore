"use client";

import { useEffect, useState } from "react";
import { QrModal } from "@/components/qr-modal";
import { SurveyBuilderPanel, type SurveyBuilderPayload } from "@/components/survey-builder";

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
  responseQuota: number | null;
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

  const [builderOpen, setBuilderOpen] = useState(false);
  const [businessId, setBusinessId] = useState("");
  const [builderSubmitting, setBuilderSubmitting] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

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
            submitting={builderSubmitting}
            error={builderError}
            onCancel={() => setBuilderOpen(false)}
            onSubmit={submitBuilder}
          />
        </div>
      )}

      {points.length === 0 ? (
        <p className="subtitle">No feedback points yet — build one above.</p>
      ) : (
        <div className="grid grid-2">
          {points.map((p) => (
            <div className="card" key={p._id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                <span className={`pill ${p.active ? "pill-accent" : "pill-gray"}`}>{p.active ? "Active" : "Inactive"}</span>
              </div>
              <p className="card-sub">{p.businessName}</p>
              {p.description && <p className="card-sub">{p.description}</p>}
              <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 10 }}>{p.scans} scans</div>
              <button className="btn btn-sm" onClick={() => setQrPoint(p)}>
                View QR
              </button>
            </div>
          ))}
        </div>
      )}

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
