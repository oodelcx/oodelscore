"use client";

import { useEffect, useState } from "react";

type Severity = "critical" | "high" | "medium" | "low";

interface AttentionItem {
  id: string;
  kind: string;
  severity: Severity;
  what: string;
  where: string;
  who: string;
  whyNow: string;
  actionLabel: string;
  actionHref: string;
  at: string;
}

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "pill-red",
  high: "pill-amber",
  medium: "pill-blue",
  low: "pill-gray",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_GROUPS: { severity: Severity; heading: string }[] = [
  { severity: "critical", heading: "Critical — escalated and still overdue" },
  { severity: "high", heading: "High — overdue or a sensitive case waiting" },
  { severity: "medium", heading: "Medium — needs a look" },
  { severity: "low", heading: "Low — worth a glance" },
];

/**
 * Shared between /business and /group — both fetch from their own
 * attention-centre route (same response shape) and render identically.
 */
export default function AttentionCentreClient({ apiPath }: { apiPath: string }) {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiPath)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        setItems(d.items ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [apiPath]);

  if (error) return <p className="error-text">{error}</p>;
  if (!items) return <p className="subtitle">Loading…</p>;

  return (
    <div>
      <h1>Attention Centre</h1>
      <p className="subtitle">
        Everything that needs a human right now — overdue cases, fired alerts, stalled playbooks, and fresh decision
        outcomes — in one deterministic, priority-sorted list. No AI ranking: the order comes from fixed rules, always
        the same ones.
      </p>

      {items.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="subtitle" style={{ margin: 0 }}>
            Nothing needs attention right now. Overdue cases, fired alerts, stalled playbooks, and fresh decision
            outcomes will show up here the moment they do.
          </p>
        </div>
      ) : (
        SEVERITY_GROUPS.map(({ severity, heading }) => {
          const group = items.filter((i) => i.severity === severity);
          if (group.length === 0) return null;
          return (
            <div key={severity} style={{ marginTop: 20 }}>
              <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {heading}
                <span className={`pill ${SEVERITY_PILL[severity]}`}>{group.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {group.map((item) => (
                  <div className="card" key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span className={`pill ${SEVERITY_PILL[item.severity]}`} style={{ fontSize: 10 }}>
                          {SEVERITY_LABEL[item.severity]}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{item.what}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                        {item.where} · {item.who}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>{item.whyNow}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <a className="btn btn-sm" href={item.actionHref}>
                        {item.actionLabel}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
