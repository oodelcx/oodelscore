"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InfoTip } from "@/components/info-tip";

interface AlertRow {
  _id: string;
  triggeredAt: string;
  snapshotValue: number;
  ruleType: string;
  metric: string;
  threshold: number | null;
  product: string;
  recipients: string[];
  isInherited: boolean;
}

const METRIC_LABELS: Record<string, string> = { star_average: "Star rating", nps: "NPS score" };
const RULE_TYPE_LABELS: Record<string, string> = {
  fixed_threshold: "Fixed threshold",
  regional_outlier: "Regional outlier",
  sudden_drop: "Sudden drop",
};

function conditionSummary(a: AlertRow): string {
  const metric = METRIC_LABELS[a.metric] ?? a.metric ?? "metric";
  if (a.ruleType === "fixed_threshold") {
    return `${metric} fell to ${a.snapshotValue}${a.threshold !== null ? ` (below ${a.threshold})` : ""}`;
  }
  if (a.ruleType === "regional_outlier") return `${metric} at ${a.snapshotValue} — a regional outlier`;
  if (a.ruleType === "sudden_drop") return `${metric} dropped to ${a.snapshotValue}`;
  return `${metric}: ${a.snapshotValue}`;
}

export default function BusinessAlertsClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);
  const [cxEnabled, setCxEnabled] = useState(true);
  const [ceEnabled, setCeEnabled] = useState(false);
  const [productFilter, setProductFilter] = useState<"all" | "customer_experience" | "colleague_experience">("all");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/business/alerts?days=${days}`)
      .then((res) => res.json())
      .then((data) => setAlerts(data.alerts ?? []))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    fetch("/api/business/me")
      .then((r) => r.json())
      .then((d) => {
        const products: string[] = d.business?.enabledProducts ?? ["customer_experience"];
        setCxEnabled(products.includes("customer_experience"));
        setCeEnabled(products.includes("colleague_experience"));
      });
  }, []);

  const filtered = alerts.filter((a) => productFilter === "all" || a.product === productFilter);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            Alerts
            <InfoTip text={tooltips["alerts"]} />
          </h1>
          <p className="subtitle">
            Every time one of your{" "}
            <Link href="/business/alert-rules">Alert Rules</Link> fired — newest first. Configure what triggers an
            alert and who gets emailed from Alert Rules; this is the record of what actually happened.
          </p>
        </div>
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
        {cxEnabled && ceEnabled && (
          <select value={productFilter} onChange={(e) => setProductFilter(e.target.value as typeof productFilter)}>
            <option value="all">All products</option>
            <option value="customer_experience">Customer Experience</option>
            <option value="colleague_experience">Colleague Pulse</option>
          </select>
        )}
      </div>

      {loading && <p className="subtitle">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="callout">
          No alerts fired in this window. That's either a quiet period or nothing's yet crossed a threshold in your{" "}
          <Link href="/business/alert-rules">Alert Rules</Link>.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table className="clean">
          <thead>
            <tr>
              <th>When</th>
              <th>Condition</th>
              <th>Rule type</th>
              <th>Notified</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a._id}>
                <td>{new Date(a.triggeredAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                <td>{conditionSummary(a)}</td>
                <td>
                  {RULE_TYPE_LABELS[a.ruleType] ?? a.ruleType}
                  {a.isInherited && <span className="pill pill-gray" style={{ marginLeft: 6 }}>From org</span>}
                </td>
                <td>
                  {a.recipients.length === 0 ? (
                    <span className="subtitle">No recipients</span>
                  ) : (
                    `${a.recipients.length} recipient${a.recipients.length === 1 ? "" : "s"}`
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
