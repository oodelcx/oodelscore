"use client";

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

function StarCell({ value, count }: { value: number | null; count: number }) {
  if (value === null) return <span style={{ color: "var(--text-3)" }}>No responses yet</span>;
  return (
    <span>
      {value.toFixed(2)}/5 <span style={{ color: "var(--text-3)", fontSize: 12.5 }}>({count} responses)</span>
    </span>
  );
}

function EnpsCell({ row }: { row: CxExCorrelationRow }) {
  if (row.ceBelowAnonymityFloor) {
    return (
      <span style={{ color: "var(--text-3)" }} title="Fewer than 5 Colleague Experience responses — held back by the anonymity floor.">
        Not enough responses to show
      </span>
    );
  }
  if (row.ceEnps === null) return <span style={{ color: "var(--text-3)" }}>No responses yet</span>;
  return (
    <span>
      {row.ceEnps > 0 ? "+" : ""}
      {row.ceEnps} <span style={{ color: "var(--text-3)", fontSize: 12.5 }}>({row.ceResponseCount} responses)</span>
    </span>
  );
}

/**
 * One row per business/branch, CX and CE side by side, worst-on-both first
 * — see computeCxExCorrelationRows in packages/shared for the ranking and
 * the anonymity-floor enforcement (a CE column never shows a number for a
 * branch with under 5 responses, full stop, same as every other CE screen).
 */
export function CxExCorrelationTable({ rows, loading, singleRowLabel }: { rows: CxExCorrelationRow[]; loading: boolean; singleRowLabel?: string }) {
  if (loading) return <p style={{ color: "var(--text-2)" }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ color: "var(--text-2)" }}>No branches to compare yet.</p>;

  const atRiskCount = rows.filter((r) => r.atRiskOnBoth).length;

  return (
    <div>
      {atRiskCount > 0 && (
        <div className="pill" style={{ background: "var(--red-bg, #fbeaea)", color: "var(--red, #b3261e)", marginBottom: 14 }}>
          {atRiskCount} {atRiskCount === 1 ? "branch is" : "branches are"} falling short on both signals
        </div>
      )}
      <table className="clean striped" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>{singleRowLabel ? "" : "Branch"}</th>
            {!singleRowLabel && <th>Region</th>}
            <th>Customer Experience — star average</th>
            <th>Colleague Experience — eNPS</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.businessId}>
              <td>{singleRowLabel ?? row.name}</td>
              {!singleRowLabel && <td>{row.region ?? "—"}</td>}
              <td>
                <StarCell value={row.cxStarAverage} count={row.cxResponseCount} />
              </td>
              <td>
                <EnpsCell row={row} />
              </td>
              <td>
                {row.atRiskOnBoth && (
                  <span className="pill" style={{ background: "var(--red-bg, #fbeaea)", color: "var(--red, #b3261e)" }}>
                    At risk on both
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
