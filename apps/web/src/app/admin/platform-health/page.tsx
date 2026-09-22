"use client";

import { useEffect, useState } from "react";

interface HealthEvent {
  _id: string;
  type: "stripe_webhook_failure" | "billing_sync_failure" | "cron_failure";
  message: string;
  context: Record<string, unknown>;
  occurredAt: string;
}
interface StuckRow {
  ownerType: "business" | "parentOrg";
  ownerId: string;
  name: string;
  createdAt: string;
  missing: string[];
}

const TYPE_LABELS: Record<HealthEvent["type"], string> = {
  stripe_webhook_failure: "Stripe webhook",
  billing_sync_failure: "Billing sync",
  cron_failure: "Cron job",
};

/**
 * Platform Health (Phase 5 item 20) — the observability gap called out in
 * the roadmap: before this, a failed webhook, a failed billing sync, or a
 * cron job that threw were only ever console.error'd, visible in Render
 * logs if someone happened to be looking. This page is the home for that
 * data, plus accounts still incomplete days after creation.
 */
export default function PlatformHealthPage() {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [stuckOnboarding, setStuckOnboarding] = useState<StuckRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/platform-health")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setStuckOnboarding(data.stuckOnboarding ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="subtitle">Loading…</p>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Platform Health</h1>
          <p className="subtitle">Failed webhooks, failed billing syncs, failed cron runs, and accounts stuck mid-onboarding.</p>
        </div>
      </div>

      <div className="section-title">Accounts stuck onboarding</div>
      <p className="card-sub" style={{ marginTop: -8 }}>
        Still missing required setup 3+ days after creation.
      </p>
      <table className="clean" style={{ marginBottom: 24 }}>
        <thead>
          <tr>
            <th>Account</th>
            <th>Created</th>
            <th>Missing</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {stuckOnboarding.map((s) => (
            <tr key={`${s.ownerType}-${s.ownerId}`}>
              <td>{s.name}</td>
              <td>{new Date(s.createdAt).toLocaleDateString()}</td>
              <td>{s.missing.join(" · ")}</td>
              <td style={{ textAlign: "right" }}>
                <a
                  className="btn btn-sm"
                  href={s.ownerType === "business" ? `/admin/businesses/${s.ownerId}` : `/admin/parent-orgs/${s.ownerId}`}
                >
                  Open →
                </a>
              </td>
            </tr>
          ))}
          {stuckOnboarding.length === 0 && (
            <tr>
              <td colSpan={4} className="subtitle">
                No accounts stuck onboarding right now.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="section-title">Recent failures</div>
      <table className="clean">
        <thead>
          <tr>
            <th>When</th>
            <th>Type</th>
            <th>Message</th>
            <th>Context</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e._id}>
              <td style={{ whiteSpace: "nowrap" }}>{new Date(e.occurredAt).toLocaleString()}</td>
              <td>
                <span className="pill pill-red">{TYPE_LABELS[e.type]}</span>
              </td>
              <td>{e.message}</td>
              <td style={{ fontSize: 12, color: "var(--text-3)" }}>
                {Object.entries(e.context)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(" · ")}
              </td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={4} className="subtitle">
                No failures recorded — the platform&apos;s been healthy.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
