"use client";

import { Fragment, useEffect, useState } from "react";

interface EntryRow {
  _id: string;
  actorEmail: string;
  actorAccountType: string | null;
  action: string;
  targetType: string;
  targetLabel: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

const LIMIT = 50;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  function load(targetPage: number, overrides?: { q?: string; action?: string }) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(targetPage), limit: String(LIMIT) });
    const effectiveQ = overrides?.q ?? q;
    const effectiveAction = overrides?.action ?? actionFilter;
    if (effectiveQ.trim()) params.set("q", effectiveQ.trim());
    if (effectiveAction) params.set("action", effectiveAction);
    fetch(`/api/admin/audit-log?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setActions(data.actions ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function runSearch() {
    if (page === 1) load(1);
    else setPage(1);
  }

  function changeActionFilter(value: string) {
    setActionFilter(value);
    if (page === 1) load(1, { action: value });
    else setPage(1);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Audit Log</h1>
          <p className="subtitle">
            A trail of sensitive changes — permission edits, staff access, billing overrides, 2FA, and access-tier
            changes. Not every action in the system is logged here, only the ones with real security or billing
            impact.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field-row">
          <div className="field">
            <label>Search (actor email, action, or target)</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="e.g. owner@business.test"
            />
          </div>
          <div className="field">
            <label>Action</label>
            <select value={actionFilter} onChange={(e) => changeActionFilter(e.target.value)}>
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-sm" onClick={runSearch}>
          Search
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <Fragment key={e._id}>
                <tr>
                  <td>{formatDate(e.createdAt)}</td>
                  <td>
                    {e.actorEmail}
                    {e.actorAccountType && <span className="subtitle"> ({e.actorAccountType})</span>}
                  </td>
                  <td>
                    <code style={{ fontSize: 12 }}>{e.action}</code>
                  </td>
                  <td>
                    {e.targetType}
                    {e.targetLabel ? `: ${e.targetLabel}` : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm" onClick={() => setExpandedId(expandedId === e._id ? null : e._id)}>
                      {expandedId === e._id ? "Hide" : "Details"}
                    </button>
                  </td>
                </tr>
                {expandedId === e._id && (
                  <tr>
                    <td colSpan={5} style={{ background: "var(--bg-2, #f7f7f8)" }}>
                      <div className="field-row" style={{ margin: "8px 0" }}>
                        <div style={{ flex: 1 }}>
                          <div className="card-sub" style={{ fontWeight: 600 }}>
                            Before
                          </div>
                          <pre style={{ fontSize: 11.5, whiteSpace: "pre-wrap", margin: 0 }}>
                            {e.before ? JSON.stringify(e.before, null, 2) : "—"}
                          </pre>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="card-sub" style={{ fontWeight: 600 }}>
                            After
                          </div>
                          <pre style={{ fontSize: 11.5, whiteSpace: "pre-wrap", margin: 0 }}>
                            {e.after ? JSON.stringify(e.after, null, 2) : "—"}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="subtitle">
                  No audit log entries match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {!loading && total > 0 && (
        <div className="pagination">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ← Prev
          </button>
          <span className="pagination-status">
            Page {page} of {totalPages} · {total} entr{total === 1 ? "y" : "ies"}
          </span>
          <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
