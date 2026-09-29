"use client";

import { useEffect, useState } from "react";

interface UpdateRow {
  _id: string;
  title: string;
  whatWeHeard: string;
  whatWereDoing: string;
  status: "draft" | "sent";
  sentAt: string | null;
  recipientCount: number;
  createdAt: string;
}

/**
 * The EX half of Closing the Loop — a "you said, we did" broadcast to the
 * whole roster (never a per-response reply; Colleague Experience never
 * links a response back to who sent it). Shared shape between business and
 * group, but each portal owns its own client since group additionally
 * picks which branches an update covers.
 */
export default function ClosingLoopClient({ apiPath }: { apiPath: string }) {
  const [updates, setUpdates] = useState<UpdateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [heardDrafts, setHeardDrafts] = useState<Record<string, string>>({});
  const [doingDrafts, setDoingDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  function load() {
    fetch(apiPath)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        setUpdates(d.updates ?? []);
        const heard: Record<string, string> = {};
        const doing: Record<string, string> = {};
        for (const u of d.updates ?? []) {
          heard[u._id] = u.whatWeHeard;
          doing[u._id] = u.whatWereDoing;
        }
        setHeardDrafts(heard);
        setDoingDrafts(doing);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath]);

  async function createDraft() {
    if (!titleDraft.trim()) return;
    setCreating(true);
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft.trim() }),
    });
    const data = await res.json().catch(() => null);
    setCreating(false);
    if (!res.ok) {
      alert(data?.message ?? "Failed to create");
      return;
    }
    setTitleDraft("");
    load();
  }

  async function saveDraft(id: string) {
    setSaving(id);
    await fetch(`${apiPath}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatWeHeard: heardDrafts[id] ?? "", whatWereDoing: doingDrafts[id] ?? "" }),
    });
    setSaving(null);
    load();
  }

  async function sendUpdate(id: string) {
    if (!confirm("Send this update to your whole Colleague Experience roster? This can't be undone.")) return;
    setSending(id);
    const res = await fetch(`${apiPath}/${id}/send`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setSending(null);
    if (!res.ok) {
      alert(data?.message ?? "Failed to send");
      return;
    }
    load();
  }

  async function deleteDraft(id: string) {
    if (!confirm("Delete this draft?")) return;
    await fetch(`${apiPath}/${id}`, { method: "DELETE" });
    load();
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!updates) return <p className="subtitle">Loading…</p>;

  return (
    <div>
      <h1>Closing the Loop</h1>
      <p className="subtitle">
        The EX half of closing the loop: a "you said, we did" update sent to your whole roster. Colleague
        Experience never links a response back to who sent it, so this is always a broadcast, never a personal
        reply to one person.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>New update</h3>
        <div className="field" style={{ maxWidth: 480 }}>
          <label>Title</label>
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder="e.g. Break room upgrade — Q3 update"
          />
        </div>
        <button className="btn btn-dark btn-sm" disabled={creating || !titleDraft.trim()} onClick={createDraft}>
          {creating ? "Creating…" : "+ Start draft"}
        </button>
      </div>

      {updates.length === 0 && <p className="subtitle">No updates yet.</p>}

      {updates.map((u) => (
        <div className="card" key={u._id} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ margin: 0 }}>{u.title}</h3>
            <span className={`pill ${u.status === "sent" ? "pill-green" : "pill-gray"}`}>{u.status}</span>
          </div>

          {u.status === "sent" ? (
            <>
              <p className="card-sub" style={{ marginTop: 8 }}>
                Sent {u.sentAt ? new Date(u.sentAt).toLocaleString() : ""} to {u.recipientCount} recipient
                {u.recipientCount === 1 ? "" : "s"}.
              </p>
              <div style={{ marginTop: 8 }}>
                <b style={{ fontSize: 12.5 }}>What we heard</b>
                <p style={{ fontSize: 13, margin: "2px 0 8px" }}>{u.whatWeHeard}</p>
                <b style={{ fontSize: 12.5 }}>What we're doing</b>
                <p style={{ fontSize: 13, margin: "2px 0 0" }}>{u.whatWereDoing}</p>
              </div>
            </>
          ) : (
            <>
              <div className="field" style={{ marginTop: 10 }}>
                <label>What we heard</label>
                <textarea
                  value={heardDrafts[u._id] ?? ""}
                  onChange={(e) => setHeardDrafts((s) => ({ ...s, [u._id]: e.target.value }))}
                  placeholder="e.g. Several of you flagged that the break room needs an upgrade."
                />
              </div>
              <div className="field">
                <label>What we're doing</label>
                <textarea
                  value={doingDrafts[u._id] ?? ""}
                  onChange={(e) => setDoingDrafts((s) => ({ ...s, [u._id]: e.target.value }))}
                  placeholder="e.g. New seating and a second coffee machine arrive next month."
                />
              </div>
              <div className="btn-group">
                <button className="btn btn-sm" disabled={saving === u._id} onClick={() => saveDraft(u._id)}>
                  {saving === u._id ? "Saving…" : "Save draft"}
                </button>
                <button className="btn btn-sm btn-dark" disabled={sending === u._id} onClick={() => sendUpdate(u._id)}>
                  {sending === u._id ? "Sending…" : "Send to roster"}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteDraft(u._id)}>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
