"use client";

import { useEffect, useState } from "react";

interface Ticket {
  _id: string;
  ownerType: "business" | "parentOrg";
  ownerId: string;
  ownerName: string;
  submittedByEmail: string;
  category: "billing" | "bug" | "access" | "other";
  subject: string;
  body: string;
  status: "open" | "in_progress" | "resolved";
  adminNote: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<Ticket["category"], string> = {
  billing: "Billing question",
  bug: "Something's broken",
  access: "Access / login issue",
  other: "Other",
};
const STATUS_LABELS: Record<Ticket["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};
const STATUS_PILL: Record<Ticket["status"], string> = {
  open: "pill-amber",
  in_progress: "pill-gray",
  resolved: "pill-green",
};

/**
 * Admin Support Queue (Phase 5 item 21) — customer-to-OodelCX issues,
 * deliberately separate from a business's own customer-feedback data. A
 * business/group owner files these from /business/support or /group/support.
 */
export default function SupportQueuePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    fetch(`/api/admin/support-tickets${qs}`)
      .then((res) => res.json())
      .then((data) => setTickets(data.tickets ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function updateTicket(id: string, patch: { status?: Ticket["status"]; adminNote?: string }) {
    setSavingId(id);
    await fetch(`/api/admin/support-tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavingId(null);
    load();
  }

  const openCount = tickets.filter((t) => t.status !== "resolved").length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Support Queue</h1>
          <p className="subtitle">
            {openCount} open of {tickets.length} — problems reported with OodelCX itself, not a customer&apos;s own feedback.
          </p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th>Category</th>
              <th>Subject</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <>
                <tr key={t._id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td>
                    <a href={t.ownerType === "business" ? `/admin/businesses/${t.ownerId}` : `/admin/parent-orgs/${t.ownerId}`}>
                      {t.ownerName}
                    </a>
                  </td>
                  <td>{CATEGORY_LABELS[t.category]}</td>
                  <td>{t.subject}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm" onClick={() => setOpenId(openId === t._id ? null : t._id)}>
                      {openId === t._id ? "Close" : "Open →"}
                    </button>
                  </td>
                </tr>
                {openId === t._id && (
                  <tr>
                    <td colSpan={6}>
                      <div style={{ margin: "6px 0 14px", padding: 14, background: "var(--bg-2, #f7f7f5)", borderRadius: 8 }}>
                        <p style={{ marginTop: 0 }}>
                          <b>From:</b> {t.submittedByEmail}
                        </p>
                        <p>
                          <b>Description</b>
                          <br />
                          {t.body}
                        </p>
                        <div className="field-row">
                          <div className="field">
                            <label>Status</label>
                            <select
                              value={t.status}
                              onChange={(e) => updateTicket(t._id, { status: e.target.value as Ticket["status"] })}
                              disabled={savingId === t._id}
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In progress</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </div>
                        </div>
                        <div className="field">
                          <label>Admin note (visible to the customer)</label>
                          <textarea
                            value={noteDrafts[t._id] ?? t.adminNote}
                            onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [t._id]: e.target.value }))}
                          />
                        </div>
                        <button
                          className="btn btn-dark btn-sm"
                          disabled={savingId === t._id}
                          onClick={() => updateTicket(t._id, { adminNote: noteDrafts[t._id] ?? t.adminNote })}
                        >
                          {savingId === t._id ? "Saving…" : "Save note"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={6} className="subtitle">
                  No tickets.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
