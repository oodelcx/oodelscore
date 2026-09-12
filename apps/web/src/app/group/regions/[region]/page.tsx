"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

interface RegionData {
  region: string;
  businessCount: number;
  average: number | null;
  nps: number | null;
  outliers: { businessId: string; name: string; starAverage: number; sigmaBelowRegion: number }[];
  branches: { businessId: string; name: string; starAverage: number | null; npsScore: number | null; responseCount: number }[];
}

export default function RegionDetailPage({ params }: { params: Promise<{ region: string }> }) {
  const { region } = use(params);
  const [data, setData] = useState<RegionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/group/regions/${encodeURIComponent(region)}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [region]);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load this region.</p>;

  const filteredBranches = data.branches.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Link className="backlink" href="/group">
        ← Back to overview
      </Link>
      <h1>{data.region} region</h1>
      <p className="subtitle">
        {data.businessCount} branches · {data.average !== null ? `${data.average}/5 average` : "no data"} ·{" "}
        {data.nps !== null ? `${data.nps} NPS` : ""} · {data.outliers.length} branches currently flagged
      </p>

      <div className="section-title">Why {data.outliers.length} are flagged</div>
      <p className="section-sub">Sourced from Alert rules — the same rules you can see and edit on Alert Rules.</p>
      <table className="clean" style={{ marginBottom: 26 }}>
        <thead>
          <tr>
            <th>Branch</th>
            <th>Average</th>
            <th>Rule triggered</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.outliers.map((o) => (
            <tr key={o.businessId}>
              <td>{o.name}</td>
              <td>{o.starAverage}/5</td>
              <td>Regional outlier — {o.sigmaBelowRegion}σ below region</td>
              <td style={{ textAlign: "right" }}>
                <Link className="btn btn-sm" href={`/group/branches/${o.businessId}`}>
                  Open →
                </Link>
              </td>
            </tr>
          ))}
          {data.outliers.length === 0 && (
            <tr>
              <td colSpan={4} className="subtitle">
                No branches currently flagged in this region.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="section-title">All branches in this region</div>
      <div className="filters">
        <input type="text" placeholder="Search branches in this region…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <table className="clean">
        <thead>
          <tr>
            <th>Branch</th>
            <th>Average</th>
            <th>NPS</th>
            <th>Responses</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredBranches.map((b) => (
            <tr key={b.businessId}>
              <td>{b.name}</td>
              <td>{b.starAverage !== null ? `${b.starAverage}/5` : "—"}</td>
              <td>{b.npsScore ?? "—"}</td>
              <td>{b.responseCount}</td>
              <td style={{ textAlign: "right" }}>
                <Link className="btn btn-sm" href={`/group/branches/${b.businessId}`}>
                  Open →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
