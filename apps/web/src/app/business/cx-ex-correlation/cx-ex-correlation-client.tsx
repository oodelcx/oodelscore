"use client";

import { useEffect, useState } from "react";
import { CxExCorrelationTable } from "@/components/cx-ex-correlation-table";

interface CxExCorrelationRow {
  businessId: string;
  name: string;
  region: string | null;
  cxStarAverage: number | null;
  cxResponseCount: number;
  ceEnps: number | null;
  ceResponseCount: number;
  ceBelowAnonymityFloor: boolean;
  atRiskOnBoth: boolean;
}

export default function BusinessCxExCorrelationClient() {
  const [rows, setRows] = useState<CxExCorrelationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business/cx-ex-correlation")
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setError(data.message ?? "Unable to load CX ↔ EX correlation.");
          return;
        }
        setRows(data.rows);
      })
      .catch(() => setError("Unable to load CX ↔ EX correlation."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>CX ↔ EX Correlation</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>
            Your Customer Experience and Colleague Experience signals side by side, so you can see if the two are moving together.
          </p>
        </div>
      </div>
      {error && <p style={{ color: "var(--red, #b3261e)" }}>{error}</p>}
      {!error && <CxExCorrelationTable rows={rows} loading={loading} singleRowLabel="This business" />}
    </div>
  );
}
