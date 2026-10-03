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

export default function GroupCxExCorrelationClient() {
  const [rows, setRows] = useState<CxExCorrelationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/group/cx-ex-correlation")
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
            Every branch, both signals — so a branch struggling with customers and its own people shows up in one glance, not two
            separate dashboards.
          </p>
        </div>
      </div>
      {error && <p style={{ color: "var(--red, #b3261e)" }}>{error}</p>}
      {!error && <CxExCorrelationTable rows={rows} loading={loading} />}
    </div>
  );
}
