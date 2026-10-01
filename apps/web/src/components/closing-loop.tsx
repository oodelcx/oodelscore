"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface UpdateRow {
  _id: string;
  title: string;
  whatWeHeard: string;
  whatWereDoing: string;
  status: "draft" | "sent";
  sentAt: string | null;
  recipientCount: number;
  createdAt: string;
  linkedDecisionId: string | null;
}

/**
 * The EX half of Closing the Loop — a "you said, we did" broadcast to the
 * whole roster (never a per-response reply; Colleague Experience never
 * links a response back to who sent it). Shared shape between business and
 * group, but each portal owns its own client since group additionally
 * picks which branches an update covers.
 */
export default function ClosingLoopClient({ apiPath }: { apiPath: string }) {
  return (
    <Suspense fallback={<p className="subtitle">Loading…</p>}>
      <ClosingLoopInner apiPath={apiPath} />
    </Suspense>
  );
}

function ClosingLoopInner({ apiPath }: { apiPath: string }) {
  const searchParams = useSearchParams();
  const [updates, setUpdates] = useState<UpdateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [newHeard, setNewHeard] = useState("");
  const [newDoing, setNewDoing] = useState("");
  const [linkedDecisionId, setLinkedDecisionId] = useState<string | null>(null);
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

  // Pre-fill "New update" when arriving from a Decision Log entry's "Close
  // the loop" button, e.g. ?new=1&title=...&whatWeHeard=...&linkedDecisionId=...
  useEffect(() => {
    if (searchParams?.get("new") !== "1") return;
    const qTitle = searchParams.get("title");
    const qHeard = searchParams.get("whatWeHeard");
    const qDoing = searchParams.get("whatWereDoing");
    const qLinkedDecisionId = searchParams.get("linkedDecisionId");
    if (qTitle) setTitleDraft(qTitle);
    if (qHeard) setNewHeard(qHeard);
    if (qDoing) setNewDoing(qDoing);
    if (qLinkedDecisionId) setLinkedDecisionId(qLinkedDecisionId);
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createDraft() {
    if (!titleDraft.trim()) return;
    setCreating(true);
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: titleDraft.trim(),
        whatWeHeard: newHeard.trim(),
        whatWereDoing: newDoing.trim(),
        linkedDecisionId,
      }),
    });
    const data = await res.json().catch(() => null);
    setCreating(false);
    if (!res.ok) {
      alert(data?.message ?? "Failed to create");
      return;
    }
    setTitleDraft("");
    setNewHeard("");
    setNewDoing("");
    setLinkedDecisionId(null);
    setShowForm(false);
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
    // Persist any unsaved edits first so what's sent matches what's on screen.
    await fetch(`${apiPath}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatWeHeard: heardDrafts[id] ?? "", whatWereDoing: doingDrafts[id] ?? "" }),
    });
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

  const drafts = updates.filter((u) => u.status === "draft");
  const sent = updates.filter((u) => u.status === "sent");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Closing the Loop</h1>
        <span className="pill pill-blue">Colleague Experience</span>
      </div>
      <p className="subtitle" style={{ maxWidth: 720 }}>
        This page is always about your team, not your customers — Colleague Experience surveys are anonymous, so
        there's no individual to reply to. Instead, you post a "you said, we did" update here and it goes out to
        everyone on your CE roster at once. (Replying to one customer about their own feedback happens on that
        customer's case in Case Management — a different page, because that side isn't anonymous.)
      </p>

      {!showForm && (
        <button className="btn btn-dark btn-sm" style={{ marginBottom: 20 }} onClick={() => setShowForm(true)}>
          + New update
        </button>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>New update</h3>
          <p className="card-sub" style={{ marginTop: -4, marginBottom: 12 }}>
            {linkedDecisionId
              ? "Pre-filled from a Decision Log entry — this update will link back to that decision."
              : "Fill in all three fields, then either save it as a draft to finish later or send it straight to your roster."}
          </p>
          <div className="field" style={{ maxWidth: 480 }}>
            <label>Title</label>
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="e.g. Break room upgrade — Q3 update"
            />
          </div>
          <div className="field">
            <label>What we heard</label>
            <textarea
              value={newHeard}
              onChange={(e) => setNewHeard(e.target.value)}
              placeholder="e.g. Several of you flagged that the break room needs an upgrade."
            />
          </div>
          <div className="field">
            <label>What we're doing</label>
            <textarea
              value={newDoing}
              onChange={(e) => setNewDoing(e.target.value)}
              placeholder="e.g. New seating and a second coffee machine arrive next month."
            />
          </div>
          <div className="btn-group">
            <button className="btn btn-sm btn-dark" disabled={creating || !titleDraft.trim()} onClick={createDraft}>
              {creating ? "Saving…" : "Save as draft"}
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                setShowForm(false);
                setTitleDraft("");
                setNewHeard("");
                setNewDoing("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {updates.length === 0 && !showForm && (
        <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
          <p className="subtitle" style={{ margin: 0 }}>
            No updates yet. Click <b>+ New update</b> above to post your first "you said, we did" to your team.
          </p>
        </div>
      )}

      {drafts.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 8px" }}>Drafts</h3>
          {drafts.map((u) => (
            <div className="card" key={u._id} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3 style={{ margin: 0 }}>{u.title}</h3>
                <span className="pill pill-gray">draft</span>
              </div>
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
                <button
                  className="btn btn-sm btn-dark"
                  disabled={sending === u._id || !(heardDrafts[u._id] ?? "").trim() || !(doingDrafts[u._id] ?? "").trim()}
                  onClick={() => sendUpdate(u._id)}
                  title={
                    !(heardDrafts[u._id] ?? "").trim() || !(doingDrafts[u._id] ?? "").trim()
                      ? "Fill in both fields before sending"
                      : undefined
                  }
                >
                  {sending === u._id ? "Sending…" : "Send to roster"}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteDraft(u._id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {sent.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 8px" }}>Sent</h3>
          {sent.map((u) => (
            <div className="card" key={u._id} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3 style={{ margin: 0 }}>{u.title}</h3>
                <span className="pill pill-green">sent</span>
              </div>
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
            </div>
          ))}
        </>
      )}
    </div>
  );
}
