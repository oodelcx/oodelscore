"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RequestRow {
  _id: string;
  businessId: string;
  businessName: string;
  requesterEmail: string;
  note: string;
  status: "pending" | "resolved";
  createdAt: string;
}

export default function FeedbackPointRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/admin/feedback-point-requests")
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setError(data.message ?? "Failed to load requests");
          return;
        }
        setRequests(data.requests ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function resolve(id: string) {
    setResolving(id);
    await fetch(`/api/admin/feedback-point-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    setResolving(null);
    load();
  }

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status === "resolved");

  return (
    <div>
      <h1>Feedback Point Requests</h1>
      <p className="subtitle">
        Businesses can&rsquo;t create their own feedback points — this is every request they&rsquo;ve raised for a new one or a
        change to an existing one.
      </p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="subtitle">Loading…</p>}

      {!loading && (
        <>
          <div className="section-title">Pending ({pending.length})</div>
          <table className="clean">
            <thead>
              <tr>
                <th>Business</th>
                <th>Requested by</th>
                <th>Note</th>
                <th>Requested</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r._id}>
                  <td>
                    <Link href={`/admin/businesses/${r.businessId}`}>{r.businessName}</Link>
                  </td>
                  <td>{r.requesterEmail}</td>
                  <td>{r.note || <span className="subtitle">(no note)</span>}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm" disabled={resolving === r._id} onClick={() => resolve(r._id)}>
                      {resolving === r._id ? "Marking…" : "Mark actioned"}
                    </button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={5} className="subtitle">
                    Nothing pending.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {resolved.length > 0 && (
            <>
              <div className="section-title">Actioned ({resolved.length})</div>
              <table className="clean">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Requested by</th>
                    <th>Note</th>
                    <th>Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((r) => (
                    <tr key={r._id}>
                      <td>
                        <Link href={`/admin/businesses/${r.businessId}`}>{r.businessName}</Link>
                      </td>
                      <td>{r.requesterEmail}</td>
                      <td>{r.note || <span className="subtitle">(no note)</span>}</td>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
