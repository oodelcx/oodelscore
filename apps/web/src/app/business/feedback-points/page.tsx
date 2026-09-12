"use client";

import { useEffect, useState } from "react";

interface FeedbackPointRow {
  _id: string;
  name: string;
  qrToken: string;
  active: boolean;
}

export default function FeedbackPointsPage() {
  const [points, setPoints] = useState<FeedbackPointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, []);

  function load() {
    setLoading(true);
    fetch("/api/business/feedback-points")
      .then((res) => res.json())
      .then((data) => setPoints(data.feedbackPoints ?? []))
      .finally(() => setLoading(false));
  }

  async function createPoint() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/business/feedback-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setName("");
    load();
  }

  async function toggleActive(point: FeedbackPointRow) {
    await fetch(`/api/business/feedback-points/${point._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !point.active }),
    });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Feedback Points</h1>
          <p className="subtitle">Each one is a QR code / link your customers use to leave feedback.</p>
        </div>
      </div>

      <div className="card">
        <h3>New feedback point</h3>
        <div className="field-row">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front counter" />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createPoint}>
          {creating ? "Creating…" : "+ Create"}
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Name</th>
              <th>Link</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td>
                  <code>{origin}/feedback/{p.qrToken}</code>
                </td>
                <td>
                  <span className={`pill ${p.active ? "pill-green" : "pill-gray"}`}>{p.active ? "Active" : "Inactive"}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-sm" onClick={() => toggleActive(p)}>
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
            {points.length === 0 && (
              <tr>
                <td colSpan={4} className="subtitle">
                  No feedback points yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
