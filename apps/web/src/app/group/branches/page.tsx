"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BranchRow {
  businessId: string;
  name: string;
  region: string;
  billingAssignment: string;
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (region) params.set("region", region);
    fetch(`/api/group/branches?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setBranches(data.branches ?? []);
        setRegions(data.regions ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [search, region]);

  return (
    <div>
      <h1>Branches</h1>
      <p className="subtitle">All branches. Search, filter, or browse by region — full detail, no matter the scale.</p>
      <div className="filters">
        <input
          type="text"
          placeholder="Search by branch name…"
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Branch</th>
              <th>Region</th>
              <th>Average</th>
              <th>NPS</th>
              <th>Responses</th>
              <th>Billed to</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.businessId}>
                <td>{b.name}</td>
                <td>{b.region || "—"}</td>
                <td>{b.starAverage !== null ? `${b.starAverage}/5` : "—"}</td>
                <td>{b.npsScore !== null ? b.npsScore : "—"}</td>
                <td>{b.responseCount}</td>
                <td>
                  <span className={`pill ${b.billingAssignment === "group_pays" ? "pill-blue" : "pill-gray"}`}>
                    {b.billingAssignment === "group_pays" ? "Group" : "Branch"}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link className="btn btn-sm" href={`/group/branches/${b.businessId}`}>
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr>
                <td colSpan={7} className="subtitle">
                  No branches match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {!loading && <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 10 }}>Showing {branches.length} of {total} branches.</p>}
    </div>
  );
}
