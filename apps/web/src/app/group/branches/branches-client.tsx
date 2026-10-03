"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InfoTip } from "@/components/info-tip";

interface BranchRow {
  businessId: string;
  name: string;
  region: string;
  billingAssignment: string;
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
}

type SortKey = "name" | "region" | "starAverage" | "npsScore" | "responseCount";

export default function BranchesClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

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

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((asc) => !asc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return "";
    return sortAsc ? " ▲" : " ▼";
  }

  const sortedBranches = [...branches].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    let cmp: number;
    if (typeof av === "string" || typeof bv === "string") {
      cmp = String(av ?? "").localeCompare(String(bv ?? ""));
    } else {
      cmp = (av ?? -Infinity) - (bv ?? -Infinity);
    }
    return sortAsc ? cmp : -cmp;
  });

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
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("name")}>
                Branch{sortIndicator("name")}
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("region")}>
                Region{sortIndicator("region")}
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("starAverage")}>
                Average{sortIndicator("starAverage")}
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("npsScore")}>
                NPS{sortIndicator("npsScore")}
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("responseCount")}>
                Responses{sortIndicator("responseCount")}
              </th>
              <th>
                Billed to
                <InfoTip text={tooltips["billed-to"]} />
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedBranches.map((b) => (
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
