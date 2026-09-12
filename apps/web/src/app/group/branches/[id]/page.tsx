"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

interface BranchDetail {
  business: { name: string; region: string; billingAssignment: string };
  metrics: { responseCount: number; starAverage: number | null; npsScore: number | null };
  openActionItems: { _id: string; title: string; status: string; overdue: boolean }[];
  cxPulse: { level: number; compositeScore: number } | null;
}

const LEVEL_LABELS = ["", "Collecting", "Reacting", "Responding", "Improving", "Embedded"];

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<BranchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/group/branches/${id}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load this branch.</p>;

  return (
    <div>
      <Link className="backlink" href={data.business.region ? `/group/regions/${encodeURIComponent(data.business.region)}` : "/group/branches"}>
        ← Back to {data.business.region || "Branches"}
      </Link>
      <h1>
        {data.business.name} <span className="pill pill-gray">Read-only</span>
      </h1>
      <p className="subtitle">Same dashboard the branch manager sees — this is where every number traces back to.</p>

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

      <div className="grid grid-2">
        <div className="card">
          <h3>Open Action Board items here</h3>
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
          <Link className="btn btn-sm" style={{ marginTop: 10, display: "inline-block" }} href="/group/action-board">
            View on Action Board →
          </Link>
        </div>
        <div className="card">
          <h3>CX Pulse</h3>
          {data.cxPulse ? (
            <div className="level-badge">
              Level {data.cxPulse.level} · {LEVEL_LABELS[data.cxPulse.level]}
            </div>
          ) : (
            <p className="subtitle">Not yet scored.</p>
          )}
        </div>
      </div>
    </div>
  );
}
