"use client";

import { useEffect, useState } from "react";

interface Ticket {
  _id: string;
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
 * Shared by /business/support and /group/support — a channel to report a
 * problem with OodelCX itself, deliberately separate from Messages (just a
 * "here's who to contact" card) and from this account's own customer
 * feedback, which has nothing to do with this page.
 */
export default function SupportTicketsClient({ apiBase }: { apiBase: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Ticket["category"]>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch(apiBase)
      .then((res) => res.json())
      .then((data) => setTickets(data.tickets ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, subject, body }),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok) {
      setError(data?.message ?? "Failed to submit");
      return;
    }
    setSubject("");
    setBody("");
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Support</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Report a problem with OodelCX itself — a billing question, a bug, or an access issue. For questions about
            your own customers&apos; feedback, use Messages instead.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24, maxWidth: 560 }}>
        <h3>New ticket</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Ticket["category"])}>
              {(Object.keys(CATEGORY_LABELS) as Ticket["category"][]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-dark" disabled={submitting} type="submit">
            {submitting ? "Submitting…" : "Submit ticket"}
          </button>
        </form>
      </div>

      <div className="section-title">Your tickets</div>
      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Admin note</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t._id}>
                <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                <td>{CATEGORY_LABELS[t.category]}</td>
                <td>{t.subject}</td>
                <td>
                  <span className={`pill ${STATUS_PILL[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                </td>
                <td>{t.adminNote || "—"}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={5} className="subtitle">
                  No tickets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
