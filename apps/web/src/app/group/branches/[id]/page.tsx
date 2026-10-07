"use client";

import { makeWording } from "@/lib/wordingPick";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { QrModal } from "@/components/qr-modal";

interface FeedbackPointRow {
  _id: string;
  name: string;
  qrToken: string;
}
interface BranchDetail {
  product?: "customer_experience" | "colleague_experience";
  wording?: Record<string, string> | null;
  business: { name: string; region: string; billingAssignment: string };
  belowAnonymityFloor?: boolean;
  metrics: { responseCount: number; starAverage: number | null; npsScore: number | null; csatPercent: number | null; cesAverage: number | null };
  openActionItems: { _id: string; title: string; status: string; overdue: boolean }[];
  cxPulse: { level: number; compositeScore: number } | null;
  feedbackPoints: FeedbackPointRow[];
}

const LEVEL_LABELS = ["", "Collecting", "Reacting", "Responding", "Improving", "Embedded"];

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<BranchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrPoint, setQrPoint] = useState<FeedbackPointRow | null>(null);

  useEffect(() => {
    fetch(`/api/group/branches/${id}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load this branch.</p>;

  const w = makeWording(data.product === "colleague_experience", data.wording);

  return (
    <div>
      <Link className="backlink" href={data.business.region ? `/group/regions/${encodeURIComponent(data.business.region)}` : "/group/branches"}>
        ← Back to {data.business.region || "Branches"}
      </Link>
      <h1>
        {data.business.name} <span className="pill pill-gray">Read-only</span>
      </h1>
      <p className="subtitle">Same dashboard the branch manager sees — this is where every number traces back to.</p>

      {data.belowAnonymityFloor && (
        <div className="callout-purple" style={{ marginBottom: 16 }}>
          Scores and trends are hidden until at least 5 colleagues have responded here, so nobody can be identified from a small group.
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="metric-label">Responses (30d)</div>
          <div className="metric-val">{data.metrics.responseCount}</div>
        </div>
        <div className="card">
          <div className="metric-label">Average score</div>
          <div className="metric-val">{data.metrics.starAverage !== null ? `${data.metrics.starAverage}/5` : "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">NPS</div>
          <div className="metric-val">{data.metrics.npsScore ?? "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">Billed to</div>
          <div className="metric-val" style={{ fontSize: 18 }}>
            {data.business.billingAssignment === "group_pays" ? "Group" : "Branch"}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="metric-label">{w("csat", "CSAT")}</div>
          <div className="metric-val">{data.metrics.csatPercent !== null ? `${data.metrics.csatPercent}%` : "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">{w("ces", "CES")}</div>
          <div className="metric-val">{data.metrics.cesAverage !== null ? `${data.metrics.cesAverage}/5` : "—"}</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Open cases here</h3>
          <table className="clean">
            <tbody>
              {data.openActionItems.map((item) => (
                <tr key={item._id}>
                  <td>{item.title}</td>
                  <td>
                    <span className={`pill ${item.overdue ? "pill-red" : "pill-amber"}`}>{item.overdue ? "Overdue" : item.status}</span>
                  </td>
                </tr>
              ))}
              {data.openActionItems.length === 0 && (
                <tr>
                  <td className="subtitle">No open items.</td>
                </tr>
              )}
            </tbody>
          </table>
          <Link className="btn btn-sm" style={{ marginTop: 10, display: "inline-block" }} href="/group/cases">
            View in Case Management →
          </Link>
        </div>
        <div className="card">
          <h3>{w("pulse", "CX Pulse")}</h3>
          {data.cxPulse ? (
            <div className="level-badge">
              Level {data.cxPulse.level} · {LEVEL_LABELS[data.cxPulse.level]}
            </div>
          ) : (
            <p className="subtitle">Not yet scored.</p>
          )}
        </div>
        <div className="card">
          <h3>Feedback QR links</h3>
          <table className="clean">
            <tbody>
              {data.feedbackPoints.map((fp) => (
                <tr key={fp._id}>
                  <td>{fp.name}</td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn btn-sm" onClick={() => setQrPoint(fp)}>
                      View QR
                    </button>
                  </td>
                </tr>
              ))}
              {data.feedbackPoints.length === 0 && (
                <tr>
                  <td className="subtitle">No active feedback points.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {qrPoint && (
        <QrModal
          name={qrPoint.name}
          qrToken={qrPoint.qrToken}
          posterHref={`/print/group-branch-feedback-point/${qrPoint._id}`}
          onClose={() => setQrPoint(null)}
        />
      )}
    </div>
  );
}
