"use client";

import { useEffect, useState } from "react";

interface EntryRow {
  _id: string;
  title: string;
  trigger: string;
  status: string;
  ownerId: string | null;
  implementationDate: string | null;
  affectedBusinessIds: string[];
  linkedActionIds: string[];
  outcomeMetricDescription: string;
  outcomeBefore: number | null;
  outcomeAfter: number | null;
  outcomeMeasuredAt: string | null;
}
interface BusinessRow {
  _id: string;
  name: string;
}
interface TeamRow {
  userId: string;
  label: string;
}
interface ActionRow {
  _id: string;
  title: string;
}

export default function DecisionLogPage() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [trigger, setTrigger] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [implementationDate, setImplementationDate] = useState("");
  const [affectedBusinessIds, setAffectedBusinessIds] = useState<string[]>([]);
  const [linkedActionIds, setLinkedActionIds] = useState<string[]>([]);
  const [outcomeMetricDescription, setOutcomeMetricDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [measuringId, setMeasuringId] = useState<string | null>(null);
  const [beforeDraft, setBeforeDraft] = useState("");
  const [afterDraft, setAfterDraft] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/group/decision-log").then((r) => r.json()),
      fetch("/api/group/businesses").then((r) => r.json()),
      fetch("/api/group/team").then((r) => r.json()),
      fetch("/api/group/action-board").then((r) => r.json()),
    ]).then(([entriesData, businessesData, teamData, actionsData]) => {
      setEntries(entriesData.entries ?? []);
      setBusinesses(businessesData.businesses ?? []);
      setTeam(teamData.team ?? []);
      setActions((actionsData.items ?? []).map((i: { _id: string; title: string }) => ({ _id: i._id, title: i.title })));
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  function toggleAffected(id: string) {
    setAffectedBusinessIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function toggleLinkedAction(id: string) {
    setLinkedActionIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function createEntry() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/group/decision-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        trigger,
        ownerId: ownerId || null,
        implementationDate: implementationDate || null,
        affectedBusinessIds,
        linkedActionIds,
        outcomeMetricDescription,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setTitle("");
    setTrigger("");
    setOwnerId("");
    setImplementationDate("");
    setAffectedBusinessIds([]);
    setLinkedActionIds([]);
    setOutcomeMetricDescription("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/group/decision-log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  function startMeasure(entry: EntryRow) {
    setMeasuringId(entry._id);
    setBeforeDraft(entry.outcomeBefore !== null ? String(entry.outcomeBefore) : "");
    setAfterDraft(entry.outcomeAfter !== null ? String(entry.outcomeAfter) : "");
  }

  async function saveMeasurement(id: string) {
    const body: Record<string, unknown> = {};
    if (beforeDraft.trim()) body.outcomeBefore = Number(beforeDraft);
    if (afterDraft.trim()) body.outcomeAfter = Number(afterDraft);
    await patch(id, body);
    setMeasuringId(null);
  }

  async function removeEntry(id: string) {
    if (!confirm("Delete this decision log entry?")) return;
    await fetch(`/api/group/decision-log/${id}`, { method: "DELETE" });
    load();
  }

  function businessName(id: string) {
    return businesses.find((b) => b._id === id)?.name ?? "—";
  }
  function ownerLabel(id: string | null) {
    if (!id) return "Unassigned";
    return team.find((t) => t.userId === id)?.label ?? "—";
  }

  function outcomeDelta(e: EntryRow): { text: string; positive: boolean } | null {
    if (e.outcomeBefore === null || e.outcomeAfter === null) return null;
    return { text: `${e.outcomeBefore} → ${e.outcomeAfter}`, positive: e.outcomeAfter > e.outcomeBefore };
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Decision Log</h1>
          <p className="subtitle">What actually changed because of what customers told you, and whether it worked.</p>
        </div>
      </div>

      <div className="card">
        <h3>Log a decision</h3>
        <div className="field-row">
          <div className="field">
            <label>Decision title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Added a second till at peak hours" />
          </div>
          <div className="field">
            <label>Decision owner</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Unassigned</option>
              {team.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Trigger — what feedback pattern prompted this</label>
          <textarea value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="e.g. Value category down 0.6 pts network-wide" />
        </div>
        <div className="field">
          <label>Branches affected</label>
          <div className="chip-select">
            {businesses.map((b) => (
              <div
                key={b._id}
                className={`chip ${affectedBusinessIds.includes(b._id) ? "active" : ""}`}
                onClick={() => toggleAffected(b._id)}
              >
                {b.name}
              </div>
            ))}
            {businesses.length === 0 && <span className="subtitle">No branches yet.</span>}
          </div>
        </div>
        <div className="field">
          <label>Linked Action Board items (optional)</label>
          <div className="chip-select">
            {actions.slice(0, 20).map((a) => (
              <div
                key={a._id}
                className={`chip ${linkedActionIds.includes(a._id) ? "active" : ""}`}
                onClick={() => toggleLinkedAction(a._id)}
              >
                {a.title}
              </div>
            ))}
            {actions.length === 0 && <span className="subtitle">No action items to link yet.</span>}
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Implementation date</label>
            <input type="date" value={implementationDate} onChange={(e) => setImplementationDate(e.target.value)} />
          </div>
          <div className="field">
            <label>How will you know it worked?</label>
            <input
              value={outcomeMetricDescription}
              onChange={(e) => setOutcomeMetricDescription(e.target.value)}
              placeholder="e.g. Value category average, checked again in 4 weeks"
            />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createEntry}>
          {creating ? "Logging…" : "+ Log decision"}
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading &&
        entries.map((e) => {
          const delta = outcomeDelta(e);
          return (
            <div className="decision-card" key={e._id}>
              <div className="decision-title">{e.title}</div>
              <div className="decision-meta">
                {e.implementationDate ? new Date(e.implementationDate).toLocaleDateString() : "No date set"} · {ownerLabel(e.ownerId)}
              </div>
              {e.trigger && (
                <div className="decision-row">
                  <div>
                    <div className="k">Trigger</div>
                    {e.trigger}
                  </div>
                </div>
              )}
              <div className="decision-row">
                <div>
                  <div className="k">Affected</div>
                  {e.affectedBusinessIds.length > 0 ? e.affectedBusinessIds.map(businessName).join(", ") : "Not specified"}
                </div>
                <div>
                  <div className="k">Status</div>
                  <select value={e.status} onChange={(ev) => patch(e._id, { status: ev.target.value })}>
                    <option value="planned">Planned</option>
                    <option value="in_progress">In progress</option>
                    <option value="implemented">Implemented</option>
                  </select>
                </div>
              </div>
              <div className="outcome-bar">
                <div className="k">Outcome</div>
                {delta ? (
                  <div className="ov" style={{ color: delta.positive ? "var(--green)" : "var(--red)" }}>
                    {e.outcomeMetricDescription || "Score"} {delta.text}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {e.outcomeMetricDescription ? `Measuring: ${e.outcomeMetricDescription}` : "Not measured yet"}
                  </div>
                )}
                <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => startMeasure(e)}>
                  {delta ? "Update measurement" : "Record measurement"}
                </button>
              </div>
              {measuringId === e._id && (
                <div className="field-row" style={{ marginTop: 10 }}>
                  <div className="field">
                    <label>Before</label>
                    <input type="number" step="0.01" value={beforeDraft} onChange={(ev) => setBeforeDraft(ev.target.value)} />
                  </div>
                  <div className="field">
                    <label>After</label>
                    <input type="number" step="0.01" value={afterDraft} onChange={(ev) => setAfterDraft(ev.target.value)} />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                    <button className="btn btn-dark btn-sm" onClick={() => saveMeasurement(e._id)}>
                      Save
                    </button>
                    <button className="btn btn-sm" onClick={() => setMeasuringId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div style={{ textAlign: "right", marginTop: 8 }}>
                <button className="icon-btn btn-danger" onClick={() => removeEntry(e._id)}>
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      {!loading && entries.length === 0 && <p className="subtitle">No decisions logged yet.</p>}
    </div>
  );
}
