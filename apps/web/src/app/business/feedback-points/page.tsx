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

  function requestChange() {
    setRequestSent(true);
    setTimeout(() => setRequestSent(false), 4000);
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
        <button className="btn btn-dark" onClick={requestChange}>
          + Request new feedback point
        </button>
      </div>

      <div className="callout">
        New feedback points and question changes are set up by your Oodel Score account manager to keep every survey
        error-free. Requests are usually actioned within one business day.
      </div>
      {requestSent && <div className="callout">Your request has been noted — your account manager will be in touch.</div>}

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
                  <button className="btn" style={{ flex: 1 }} onClick={requestChange}>
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
