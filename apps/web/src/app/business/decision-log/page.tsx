"use client";

import { Fragment, useEffect, useState } from "react";

interface EntryRow {
  _id: string;
  title: string;
  trigger: string;
  status: string;
  outcomeBefore: number | null;
  outcomeAfter: number | null;
}

function outcomeDelta(entry: EntryRow): string | null {
  if (entry.outcomeBefore === null || entry.outcomeAfter === null) return null;
  const delta = Math.round((entry.outcomeAfter - entry.outcomeBefore) * 100) / 100;
  return delta > 0 ? `+${delta}` : String(delta);
}

export default function BusinessDecisionLogPage() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [trigger, setTrigger] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [measuringId, setMeasuringId] = useState<string | null>(null);
  const [outcomeBeforeDraft, setOutcomeBeforeDraft] = useState("");
  const [outcomeAfterDraft, setOutcomeAfterDraft] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/business/decision-log")
      .then((res) => res.json())
      .then((data) => setEntries(data.entries ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createEntry() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/business/decision-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, trigger }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setTitle("");
    setTrigger("");
    load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/business/decision-log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function removeEntry(id: string) {
    if (!confirm("Delete this decision log entry?")) return;
    await fetch(`/api/business/decision-log/${id}`, { method: "DELETE" });
    load();
  }

  function startMeasure(entry: EntryRow) {
    setMeasuringId(entry._id);
    setOutcomeBeforeDraft(entry.outcomeBefore !== null ? String(entry.outcomeBefore) : "");
    setOutcomeAfterDraft(entry.outcomeAfter !== null ? String(entry.outcomeAfter) : "");
  }

  async function saveOutcome(id: string) {
    const patch: Record<string, number> = {};
    if (outcomeBeforeDraft.trim()) patch.outcomeBefore = Number(outcomeBeforeDraft);
    if (outcomeAfterDraft.trim()) patch.outcomeAfter = Number(outcomeAfterDraft);
    await fetch(`/api/business/decision-log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setMeasuringId(null);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Decision Log</h1>
          <p className="subtitle">
            Track decisions and changes made in response to feedback, and measure the outcome. Resolving an Action
            Board item with a note logs one here automatically.
          </p>
        </div>
      </div>

      <div className="card">
        <h3>New entry</h3>
        <div className="field-row">
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Trigger</label>
            <input value={trigger} onChange={(e) => setTrigger(e.target.value)} />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createEntry}>
          {creating ? "Creating…" : "+ Log decision"}
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Title</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Outcome</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <Fragment key={e._id}>
                <tr>
                  <td>{e.title}</td>
                  <td>{e.trigger || "—"}</td>
                  <td>
                    <select value={e.status} onChange={(ev) => updateStatus(e._id, ev.target.value)}>
                      <option value="planned">Planned</option>
                      <option value="in_progress">In progress</option>
                      <option value="implemented">Implemented</option>
                    </select>
                  </td>
                  <td>
                    {e.outcomeBefore !== null && e.outcomeAfter !== null ? (
                      <>
                        {e.outcomeBefore} → {e.outcomeAfter}{" "}
                        <span className={`pill ${(outcomeDelta(e) ?? "").startsWith("+") ? "pill-green" : "pill-red"}`}>
                          {outcomeDelta(e)}
                        </span>
                      </>
                    ) : (
                      "not measured yet"
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm" style={{ marginRight: 8 }} onClick={() => startMeasure(e)}>
                      Measure outcome
                    </button>
                    <button className="icon-btn btn-danger" onClick={() => removeEntry(e._id)}>
                      🗑
                    </button>
                  </td>
                </tr>
                {measuringId === e._id && (
                  <tr>
                    <td colSpan={5}>
                      <div className="field-row" style={{ margin: "6px 0" }}>
                        <div className="field">
                          <label>Outcome before</label>
                          <input
                            type="number"
                            step="0.1"
                            value={outcomeBeforeDraft}
                            onChange={(ev) => setOutcomeBeforeDraft(ev.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label>Outcome after</label>
                          <input
                            type="number"
                            step="0.1"
                            value={outcomeAfterDraft}
                            onChange={(ev) => setOutcomeAfterDraft(ev.target.value)}
                          />
                        </div>
                      </div>
                      <button className="btn btn-dark btn-sm" onClick={() => saveOutcome(e._id)}>
                        Save outcome
                      </button>{" "}
                      <button className="btn btn-sm" onClick={() => setMeasuringId(null)}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="subtitle">
                  No decisions logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
