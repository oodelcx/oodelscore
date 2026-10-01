"use client";

import { useEffect, useState } from "react";

interface IndustryRow {
  industry: string;
  sampleSize: number;
  avgLevel: number;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Absent",
  2: "Ad hoc",
  3: "Emerging",
  4: "Established",
  5: "Leading",
};

export default function SectorBenchmarksPage() {
  const [industries, setIndustries] = useState<IndustryRow[]>([]);
  const [optedInCount, setOptedInCount] = useState(0);
  const [minGroupSize, setMinGroupSize] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/sector-benchmarks")
      .then((res) => res.json())
      .then((data) => {
        setIndustries(data.industries ?? []);
        setOptedInCount(data.optedInCount ?? 0);
        setMinGroupSize(data.minGroupSize ?? 3);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Sector Benchmarks</h1>
          <p className="subtitle">
            Average OodelCX Compass maturity by industry, computed only from businesses that opted in to anonymized
            benchmarking. An industry with fewer than {minGroupSize} opted-in businesses is left out — a smaller group
            would make the average attributable back to a real business.
          </p>
        </div>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <>
          <p className="subtitle">{optedInCount} business(es) currently opted in across the platform.</p>
          <table className="clean">
            <thead>
              <tr>
                <th>Industry</th>
                <th>Businesses in group</th>
                <th>Average maturity level</th>
              </tr>
            </thead>
            <tbody>
              {industries.map((row) => (
                <tr key={row.industry}>
                  <td>{row.industry}</td>
                  <td>{row.sampleSize}</td>
                  <td>
                    {row.avgLevel.toFixed(1)} — {LEVEL_LABELS[Math.round(row.avgLevel)] ?? ""}
                  </td>
                </tr>
              ))}
              {industries.length === 0 && (
                <tr>
                  <td colSpan={3} className="subtitle">
                    No industry has enough opted-in businesses yet to publish a benchmark.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
