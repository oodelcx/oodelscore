"use client";

import { useEffect, useState } from "react";

interface BusinessOption {
  businessId: string;
  name: string;
}
interface CompareBranch {
  businessId: string;
  name: string;
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
  cxPulseLevel: number | null;
  trend: { date: string; starAverage: number | null }[];
}

const MAX_COMPARE = 6;

function trendSvgPoints(trend: { starAverage: number | null }[], color: string, key: string) {
  const known = trend.map((t) => t.starAverage).filter((v): v is number => v !== null);
  if (known.length === 0) return null;
  const width = 400;
  const height = 100;
  const step = width / Math.max(trend.length - 1, 1);
  const points = trend
    .map((point, i) => {
      const v = point.starAverage ?? known[known.length - 1];
      const y = height - (v / 5) * height;
      return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return <polyline key={key} fill="none" stroke={color} strokeWidth="2" points={points} />;
}

const COLORS = ["#0F6E56", "#E24B4A", "#EF9F27", "#185FA5", "#7F77DD", "#3B6D11"];

export default function ComparePage() {
  const [options, setOptions] = useState<BusinessOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [branches, setBranches] = useState<CompareBranch[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/group/branches")
      .then((res) => res.json())
      .then((data) => setOptions((data.branches ?? []).map((b: { businessId: string; name: string }) => ({ businessId: b.businessId, name: b.name }))));
  }, []);

  useEffect(() => {
    if (selected.length === 0) {
      setBranches([]);
      return;
    }
    fetch(`/api/group/compare?ids=${selected.join(",")}`)
      .then((res) => res.json())
      .then((data) => setBranches(data.branches ?? []));
  }, [selected]);

  function addBranch(id: string) {
    if (selected.includes(id) || selected.length >= MAX_COMPARE) return;
    setSelected((s) => [...s, id]);
    setSearch("");
  }
  function removeBranch(id: string) {
    setSelected((s) => s.filter((x) => x !== id));
  }

  const searchResults = search ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()) && !selected.includes(o.businessId)) : [];

  return (
    <div>
      <h1>Compare branches</h1>
      <p className="subtitle">Search and add up to {MAX_COMPARE} branches to compare category by category.</p>

      <div className="filters" style={{ position: "relative" }}>
        <input
          type="text"
          placeholder="Search branches to add…"
          style={{ width: 260 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {searchResults.length > 0 && (
          <div className="card" style={{ position: "absolute", top: 36, left: 0, zIndex: 5, padding: 6, width: 260 }}>
            {searchResults.slice(0, 6).map((o) => (
              <div key={o.businessId} className="config-row" style={{ cursor: "pointer", padding: "6px 8px" }} onClick={() => addBranch(o.businessId)}>
                {o.name}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="filters">
        {selected.map((id) => {
          const option = options.find((o) => o.businessId === id);
          return (
            <div className="compare-chip" key={id}>
              {option?.name ?? id} <span className="x" onClick={() => removeBranch(id)}>×</span>
            </div>
          );
        })}
        <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
          {selected.length} of {MAX_COMPARE} selected
        </span>
      </div>

      {branches.length > 0 && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 24 }}>
            {branches.map((b) => (
              <div className="compare-summary" key={b.businessId}>
                <div className="cs-name">{b.name}</div>
                <div className="cs-row">
                  <span>Average</span>
                  <b>{b.starAverage !== null ? `${b.starAverage}/5` : "—"}</b>
                </div>
                <div className="cs-row">
                  <span>NPS</span>
                  <b>{b.npsScore ?? "—"}</b>
                </div>
                <div className="cs-row">
                  <span>Responses (30d)</span>
                  <b>{b.responseCount}</b>
                </div>
                <div className="cs-row">
                  <span>CX Pulse</span>
                  <b>{b.cxPulseLevel ? `Level ${b.cxPulseLevel}` : "—"}</b>
                </div>
              </div>
            ))}
          </div>

          <div className="section-title">Response trend, overlaid</div>
          <div className="card">
            <svg viewBox="0 0 400 100" width="100%" height="140">
              {branches.map((b, i) => trendSvgPoints(b.trend, COLORS[i % COLORS.length], b.businessId))}
            </svg>
            <div className="legend-row">
              {branches.map((b, i) => (
                <span key={b.businessId}>
                  <span className="dot" style={{ background: COLORS[i % COLORS.length] }}></span>
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
      {selected.length === 0 && <p className="subtitle">Search above to add branches to compare.</p>}
    </div>
  );
}
