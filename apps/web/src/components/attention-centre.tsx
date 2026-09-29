"use client";

import { useEffect, useMemo, useState } from "react";

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

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

const KIND_LABEL: Record<string, string> = {
  overdue_escalated_case: "Overdue escalated case",
  overdue_case: "Overdue case",
  stalled_sensitive_case: "Stalled sensitive case",
  awaiting_customer_reply: "Awaiting customer reply",
  alert_fired: "Alert fired",
  stalled_playbook: "Stalled playbook",
  decision_ready_for_review: "Decision ready for review",
  initiative_not_started: "Initiative not started",
};

const PAGE_SIZE = 15;

/**
 * Shared between /business and /group — both fetch from their own
 * attention-centre route (same response shape) and render identically.
 * Deterministic severity/age sort comes pre-applied from the API; this
 * component only filters/paginates the list it's given, never re-sorts it.
 */
export default function AttentionCentreClient({ apiPath }: { apiPath: string }) {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(apiPath)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        setItems(d.items ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [apiPath]);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of items ?? []) c[i.severity]++;
    return c;
  }, [items]);

  const kindsPresent = useMemo(() => {
    const set = new Set<string>();
    for (const i of items ?? []) set.add(i.kind);
    return [...set];
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (severityFilter !== "all" && i.severity !== severityFilter) return false;
      if (kindFilter !== "all" && i.kind !== kindFilter) return false;
      if (q && !`${i.what} ${i.where} ${i.who} ${i.whyNow}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, severityFilter, kindFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!items) return <p className="subtitle">Loading…</p>;

  const total = items.length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Attention Centre</h1>
          <p className="subtitle" style={{ maxWidth: 640 }}>
            Everything that needs a human right now — overdue cases, fired alerts, stalled playbooks, and fresh
            decision outcomes — in one deterministic, priority-sorted list. No AI ranking: the order comes from
            fixed rules, always the same ones.
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="card" style={{ marginTop: 16, textAlign: "center", padding: "32px 20px" }}>
          <p className="subtitle" style={{ margin: 0 }}>
            Nothing needs attention right now. Overdue cases, fired alerts, stalled playbooks, and fresh decision
            outcomes will show up here the moment they do.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <button
              className="card"
              onClick={() => resetToFirstPage(setSeverityFilter)("all")}
              style={{
                textAlign: "left",
                cursor: "pointer",
                border: severityFilter === "all" ? "2px solid var(--text-1, #111)" : undefined,
              }}
            >
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-3)" }}>
                All items
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>{total}</div>
            </button>
            {SEVERITY_ORDER.map((sev) => (
              <button
                key={sev}
                className="card"
                onClick={() => resetToFirstPage(setSeverityFilter)(sev)}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  border: severityFilter === sev ? "2px solid var(--text-1, #111)" : undefined,
                  opacity: counts[sev] === 0 ? 0.55 : 1,
                }}
                disabled={counts[sev] === 0}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className={`pill ${SEVERITY_PILL[sev]}`} style={{ fontSize: 10 }}>
                    {SEVERITY_LABEL[sev]}
                  </span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>{counts[sev]}</div>
              </button>
            ))}
          </div>

          <div
            className="card"
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-end",
              marginBottom: 16,
              padding: "12px 16px",
            }}
          >
            <div className="field" style={{ margin: 0, minWidth: 220, flex: "1 1 220px" }}>
              <label style={{ fontSize: 11 }}>Search</label>
              <input
                type="text"
                placeholder="Filter by title, location, owner…"
                value={search}
                onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0, minWidth: 200 }}>
              <label style={{ fontSize: 11 }}>Type</label>
              <select value={kindFilter} onChange={(e) => resetToFirstPage(setKindFilter)(e.target.value)}>
                <option value="all">All types</option>
                {kindsPresent.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k] ?? k}
                  </option>
                ))}
              </select>
            </div>
            {(severityFilter !== "all" || kindFilter !== "all" || search) && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  setSeverityFilter("all");
                  setKindFilter("all");
                  setSearch("");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
              <p className="subtitle" style={{ margin: 0 }}>
                No items match the current filters.
              </p>
            </div>
          ) : (
            <>
              <p className="card-sub" style={{ margin: "0 0 8px" }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
                {filtered.length !== total ? ` (filtered from ${total})` : ""}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pageItems.map((item) => (
                  <div
                    className="card"
                    key={item.id}
                    style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
                  >
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span className={`pill ${SEVERITY_PILL[item.severity]}`} style={{ fontSize: 10 }}>
                          {SEVERITY_LABEL[item.severity]}
                        </span>
                        <span className="pill pill-gray" style={{ fontSize: 10 }}>
                          {KIND_LABEL[item.kind] ?? item.kind}
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

              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 20 }}>
                  <button
                    className="btn btn-sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </button>
                  <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="btn btn-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
