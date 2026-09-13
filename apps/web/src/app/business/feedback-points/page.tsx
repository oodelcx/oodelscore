"use client";

import { useEffect, useState } from "react";
import { QrModal } from "@/components/qr-modal";

interface FeedbackPointRow {
  _id: string;
  name: string;
  description: string;
  qrToken: string;
  scans: number;
  active: boolean;
}

export default function FeedbackPointsPage() {
  const [points, setPoints] = useState<FeedbackPointRow[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [requestSent, setRequestSent] = useState(false);
  const [qrPoint, setQrPoint] = useState<FeedbackPointRow | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/business/feedback-points").then((r) => r.json()),
      fetch("/api/business/responses").then((r) => r.json()),
    ]).then(([pointsData, responsesData]) => {
      setPoints(pointsData.feedbackPoints ?? []);
      const counts: Record<string, number> = {};
      for (const r of responsesData.responses ?? []) {
        counts[r.feedbackPointId] = (counts[r.feedbackPointId] ?? 0) + 1;
      }
      setResponseCounts(counts);
      setLoading(false);
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
      const res = await fetch("/api/business/feedback-points/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: requestNote.trim() }),
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
        <button className="btn btn-dark" onClick={openRequest}>
          + Request new feedback point
        </button>
      </div>

      <div className="callout">
        New feedback points and question changes are set up by your Oodel Score account manager to keep every survey
        error-free. Requests are usually actioned within one business day.
      </div>
      {requestSent && <div className="callout">Your request has been sent — your account manager will be in touch.</div>}
      {requestOpen && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Request a feedback point</h3>
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
          {points.map((p) => {
            const responses = responseCounts[p._id] ?? 0;
            const conversion = p.scans > 0 ? Math.round((responses / p.scans) * 100) : null;
            return (
              <div className="card" key={p._id}>
                <h3>{p.name}</h3>
                <p className="card-sub">{p.description || "—"}</p>
                <div style={{ display: "flex", gap: 18, fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
                  <div>{p.scans} scans</div>
                  <div>{responses} responses</div>
                  <div>
                    <strong style={{ color: "var(--text)" }}>{conversion !== null ? `${conversion}%` : "—"}</strong> conversion
                  </div>
                </div>
                <div className="badge-row">
                  <span className={`pill ${p.active ? "pill-accent" : "pill-gray"}`}>{p.active ? "Active" : "Inactive"}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={() => setQrPoint(p)}>
                    View QR
                  </button>
                  <button className="btn" style={{ flex: 1 }} onClick={openRequest}>
                    Request changes
                  </button>
                </div>
              </div>
            );
          })}
          {points.length === 0 && <p className="subtitle">No feedback points yet — request one above.</p>}
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
