"use client";

import { useEffect, useState } from "react";

interface DriverRow {
  categoryId: string;
  name: string;
  categoryAverage: number;
  correlation: number | null;
  sampleSize: number;
  confidence: "reliable" | "low" | "insufficient";
  classification: "priority" | "strength" | "moderate";
}

const CLASSIFICATION_LABEL: Record<DriverRow["classification"], string> = {
  priority: "Priority",
  strength: "Strength",
  moderate: "Moderate",
};
const CLASSIFICATION_PILL: Record<DriverRow["classification"], string> = {
  priority: "pill-red",
  strength: "pill-green",
  moderate: "pill-amber",
};

/** Shared by Business and Group Analytics — "what's driving your score", computed from data already collected, no AI call. */
export function DriverAnalysisCard({ apiPath }: { apiPath: string }) {
  const [drivers, setDrivers] = useState<DriverRow[] | null>(null);
  const [windowDays, setWindowDays] = useState(90);

  useEffect(() => {
    fetch(apiPath)
      .then((res) => res.json())
      .then((d) => {
        setDrivers(d.drivers ?? []);
        if (d.windowDays) setWindowDays(d.windowDays);
      });
  }, [apiPath]);

  return (
    <div className="card">
      <h3>What&rsquo;s driving your score</h3>
      <p className="card-sub">
        How strongly each category correlates with the rest of a response&rsquo;s rating, over the last {windowDays} days.
        Priority categories score below average and move the needle most — fix these first.
      </p>
      {drivers === null && <p className="subtitle">Loading…</p>}
      {drivers !== null && drivers.length === 0 && <p className="subtitle">Not enough categorized feedback yet.</p>}
      {drivers !== null && drivers.length > 0 && (
        <table className="clean">
          <thead>
            <tr>
              <th>Category</th>
              <th>Average</th>
              <th>Correlation</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.categoryId}>
                <td>{d.name}</td>
                <td>{d.categoryAverage.toFixed(2)}</td>
                <td>
                  {d.confidence === "insufficient" ? (
                    <span className="subtitle">Insufficient data ({d.sampleSize})</span>
                  ) : (
                    <>
                      {d.correlation !== null ? d.correlation.toFixed(2) : "—"}
                      {d.confidence === "low" && <span className="subtitle"> (low confidence, n={d.sampleSize})</span>}
                    </>
                  )}
                </td>
                <td>
                  {d.confidence !== "insufficient" && d.classification !== "moderate" && (
                    <span className={`pill ${CLASSIFICATION_PILL[d.classification]}`}>{CLASSIFICATION_LABEL[d.classification]}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
