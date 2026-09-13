"use client";

import { useEffect, useState } from "react";

interface BusinessOption {
  businessId: string;
  name: string;
}
interface CategoryEntry {
  categoryId: string;
  name: string;
  average: number;
}
interface CompareBranch {
  businessId: string;
  name: string;
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
  cxPulseLevel: number | null;
  trend: { date: string; starAverage: number | null }[];
  categoryBreakdown: CategoryEntry[];
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
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/group/branches")
      .then((res) => res.json())
      .then((data) => setOptions((data.branches ?? []).map((b: { businessId: string; name: string }) => ({ businessId: b.businessId, name: b.name }))));
  }, []);

  useEffect(() => {
    if (selected.length === 0) {
      setBranches([]);
      setCategoryNames([]);
      return;
    }
    fetch(`/api/group/compare?ids=${selected.join(",")}`)
      .then((res) => res.json())
      .then((data) => {
        setBranches(data.branches ?? []);
        setCategoryNames(data.categoryNames ?? []);
      });
  }, [selected]);

  function categoryAverage(branch: CompareBranch, name: string): number | null {
    return branch.categoryBreakdown.find((c) => c.name === name)?.average ?? null;
  }

  // The biggest single-category gap between the top and bottom performer by
  // overall average — "worth checking against the open Action Board item
  // there" per the mockup's callout.
  const gapInsight = (() => {
    if (branches.length < 2 || categoryNames.length === 0) return null;
    const sorted = [...branches].sort((a, b) => (b.starAverage ?? 0) - (a.starAverage ?? 0));
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    if (top.businessId === bottom.businessId) return null;
    let biggestGapCategory: string | null = null;
    let biggestGap = -Infinity;
    for (const name of categoryNames) {
      const topVal = categoryAverage(top, name);
      const bottomVal = categoryAverage(bottom, name);
      if (topVal === null || bottomVal === null) continue;
      const gap = topVal - bottomVal;
      if (gap > biggestGap) {
        biggestGap = gap;
        biggestGapCategory = name;
      }
    }
    if (!biggestGapCategory) return null;
    return {
      top,
      bottom,
      category: biggestGapCategory,
      topVal: categoryAverage(top, biggestGapCategory) as number,
      bottomVal: categoryAverage(bottom, biggestGapCategory) as number,
    };
  })();

  function toggleBranch(id: string) {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= MAX_COMPARE) return s;
      return [...s, id];
    });
  }
  function removeBranch(id: string) {
    setSelected((s) => s.filter((x) => x !== id));
  }

  const filteredOptions = search ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase())) : options;

  return (
    <div>
      <h1>Compare branches</h1>
      <p className="subtitle">Search and add up to {MAX_COMPARE} branches to compare category by category.</p>

      <div className="card" style={{ maxWidth: 420, marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder={`Filter ${options.length} branches…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {filteredOptions.map((o) => {
            const checked = selected.includes(o.businessId);
            const disabled = !checked && selected.length >= MAX_COMPARE;
            return (
              <label
                key={o.businessId}
                className="field-check"
                style={{ margin: 0, padding: "6px 4px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}
              >
                <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleBranch(o.businessId)} />
                <span>{o.name}</span>
              </label>
            );
          })}
          {filteredOptions.length === 0 && <p className="subtitle" style={{ margin: "4px" }}>No branches match.</p>}
        </div>
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

          <div className="section-title">By category</div>
          <p className="section-sub">Where the real gaps are, not just the overall average.</p>
          {categoryNames.length === 0 ? (
            <p className="subtitle">No categorized star-rating questions have responses in the last 30 days.</p>
          ) : (
            <div className="card" style={{ marginBottom: 24 }}>
              {categoryNames.map((name) => (
                <div className="grouped-bar" key={name}>
                  <div className="glabel">{name}</div>
                  <div className="gtrack">
                    {branches.map((b, i) => {
                      const value = categoryAverage(b, name);
                      return (
                        <div className="gseg" key={b.businessId}>
                          <div className="gfill-track">
                            <div
                              className="gfill"
                              style={{ width: `${value !== null ? (value / 5) * 100 : 0}%`, background: COLORS[i % COLORS.length] }}
                            />
                          </div>
                          <div className="gval">{value !== null ? value.toFixed(1) : "—"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="legend-row">
                {branches.map((b, i) => (
                  <span key={b.businessId}>
                    <span className="dot" style={{ background: COLORS[i % COLORS.length] }}></span>
                    {b.name}
                  </span>
                ))}
              </div>
              {gapInsight && (
                <div className="callout" style={{ margin: "18px 0 0" }}>
                  {gapInsight.bottom.name}&apos;s biggest gap vs {gapInsight.top.name} is {gapInsight.category} (
                  {gapInsight.bottomVal.toFixed(1)} vs {gapInsight.topVal.toFixed(1)}) — worth checking against any open Action Board
                  item there.
                </div>
              )}
            </div>
          )}

          <div className="section-title">Full comparison table</div>
          <div style={{ overflowX: "auto" }}>
            <table className="clean">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Average</th>
                  <th>NPS</th>
                  {categoryNames.map((name) => (
                    <th key={name}>{name}</th>
                  ))}
                  <th>Responses</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.businessId}>
                    <td>{b.name}</td>
                    <td>
                      <b
                        style={{
                          color: b.starAverage === null ? undefined : b.starAverage >= 4 ? "var(--green)" : b.starAverage >= 3.5 ? "var(--amber)" : "var(--red)",
                        }}
                      >
                        {b.starAverage !== null ? `${b.starAverage}/5` : "—"}
                      </b>
                    </td>
                    <td>{b.npsScore ?? "—"}</td>
                    {categoryNames.map((name) => {
                      const value = categoryAverage(b, name);
                      return <td key={name}>{value !== null ? value.toFixed(1) : "—"}</td>;
                    })}
                    <td>{b.responseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {selected.length === 0 && <p className="subtitle">Search above to add branches to compare.</p>}
    </div>
  );
}
