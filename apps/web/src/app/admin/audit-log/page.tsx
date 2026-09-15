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

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (actionFilter) params.set("action", actionFilter);
    fetch(`/api/admin/audit-log?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setActions(data.actions ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter]);

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
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="e.g. owner@business.test"
            />
          </div>
          <div className="field">
            <label>Action</label>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-sm" onClick={load}>
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
    </div>
  );
}
