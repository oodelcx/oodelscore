"use client";

import { useEffect, useState } from "react";

interface RosterStats {
  totalEnrolled: number;
  totalActive: number;
  dueOnboarding30: number;
  dueOnboarding90: number;
  dueExit: number;
}

interface RosterSurveyPoint {
  _id: string;
  name: string;
  active: boolean;
  pulseCadence: string | null;
  lastSentAt: string | null;
  tokensIssued: number;
  tokensUsed: number;
  participationRate: number | null;
}

function formatCadence(sp: RosterSurveyPoint): string {
  const cadenceLabel = sp.pulseCadence === "weekly" ? "Weekly" : sp.pulseCadence === "monthly" ? "Monthly" : "Manual";
  if (!sp.lastSentAt) return `${cadenceLabel} — never sent`;
  const days = Math.floor((Date.now() - new Date(sp.lastSentAt).getTime()) / (24 * 60 * 60 * 1000));
  const ago = days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
  return `${cadenceLabel} — last sent ${ago}`;
}

export default function BusinessRosterClient() {
  const [stats, setStats] = useState<RosterStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [surveyPoints, setSurveyPoints] = useState<RosterSurveyPoint[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const [singleEmail, setSingleEmail] = useState("");
  const [singleStartDate, setSingleStartDate] = useState("");
  const [addStatus, setAddStatus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);

  const [exitEmail, setExitEmail] = useState("");
  const [exitDate, setExitDate] = useState("");
  const [exitStatus, setExitStatus] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  const [removeEmail, setRemoveEmail] = useState("");
  const [removeStatus, setRemoveStatus] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/business/roster").then((r) => r.json()),
      fetch("/api/business/roster/send-links").then((r) => r.json()),
    ]).then(([rosterData, linksData]) => {
      if (rosterData.status === "ok") setStats(rosterData.stats);
      if (linksData.status === "ok") setSurveyPoints(linksData.feedbackPoints ?? []);
      setLoading(false);
    });
  }

  useEffect(load, []);

  async function sendLinks(feedbackPointId: string) {
    setSendingId(feedbackPointId);
    setSendStatus(null);
    const res = await fetch("/api/business/roster/send-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackPointId }),
    });
    const data = await res.json();
    setSendingId(null);
    if (data.status === "ok") {
      setSendStatus(`Sent to ${data.sent}${data.failed ? ` (${data.failed} failed)` : ""}.`);
      load();
    } else {
      setSendStatus(data.message ?? "Something went wrong.");
    }
  }

  async function addSingle(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddStatus(null);
    const res = await fetch("/api/business/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [{ email: singleEmail, startDate: singleStartDate || null }] }),
    });
    const data = await res.json();
    setAdding(false);
    if (data.status === "ok") {
      setAddStatus(data.upserted > 0 ? "Added." : "Updated existing entry.");
      setSingleEmail("");
      setSingleStartDate("");
      load();
    } else {
      setAddStatus(data.message ?? "Something went wrong.");
    }
  }

  async function uploadBulk(e: React.FormEvent) {
    e.preventDefault();
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const entries = lines.map((line) => {
      const [email, startDate] = line.split(",").map((p) => p.trim());
      return { email, startDate: startDate || null };
    });
    if (entries.length === 0) {
      setBulkStatus("Paste at least one row (email, start date).");
      return;
    }
    setBulkUploading(true);
    setBulkStatus(null);
    const res = await fetch("/api/business/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    const data = await res.json();
    setBulkUploading(false);
    if (data.status === "ok") {
      setBulkStatus(
        `${data.upserted} added, ${data.updated} updated${data.skipped ? `, ${data.skipped} skipped (invalid email)` : ""}.`
      );
      setBulkText("");
      load();
    } else {
      setBulkStatus(data.message ?? "Something went wrong.");
    }
  }

  async function markExited(e: React.FormEvent) {
    e.preventDefault();
    setExiting(true);
    setExitStatus(null);
    const res = await fetch("/api/business/roster", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: exitEmail, endDate: exitDate || null }),
    });
    const data = await res.json();
    setExiting(false);
    if (data.status === "ok") {
      setExitStatus("Marked exited — the exit survey will go out on the next daily run.");
      setExitEmail("");
      setExitDate("");
      load();
    } else {
      setExitStatus(data.message ?? "Something went wrong.");
    }
  }

  async function removeEntry(e: React.FormEvent) {
    e.preventDefault();
    setRemoving(true);
    setRemoveStatus(null);
    const res = await fetch(`/api/business/roster?email=${encodeURIComponent(removeEmail)}`, { method: "DELETE" });
    const data = await res.json();
    setRemoving(false);
    if (data.status === "ok") {
      setRemoveStatus("Removed.");
      setRemoveEmail("");
      load();
    } else {
      setRemoveStatus(data.message ?? "Something went wrong.");
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Colleague Roster</h1>
        <p className="subtitle" style={{ margin: 0 }}>
          Who gets Colleague Experience's onboarding and exit surveys, and when. This list is write-only by design —
          it's used only to know who to send a lifecycle survey to and when, never to look anyone's feedback back up
          to them. There's no browse screen on purpose.
        </p>
      </div>

      {loading ? (
        <p className="subtitle">Loading…</p>
      ) : (
        <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          <StatCard label="Enrolled" value={stats?.totalEnrolled ?? 0} />
          <StatCard label="Currently active" value={stats?.totalActive ?? 0} />
          <StatCard label="Due — 30-day check-in" value={stats?.dueOnboarding30 ?? 0} />
          <StatCard label="Due — 90-day check-in" value={stats?.dueOnboarding90 ?? 0} />
          <StatCard label="Due — exit survey" value={stats?.dueExit ?? 0} />
        </div>
      )}

      <div className="callout" style={{ marginBottom: 16 }}>
        <strong>Note:</strong> a due count only clears once a lifecycle-trigger survey is configured for that stage
        (Admin sets this per Feedback Point) and the daily sweep has run.
      </div>

      {surveyPoints.length > 0 && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Roster-personalized surveys</h3>
          <p className="subtitle" style={{ marginTop: 0 }}>
            One link per active roster entry. Sending resends to anyone who hasn&apos;t responded yet — it never
            re-sends to someone who already did.
          </p>
          <table className="clean">
            <thead>
              <tr>
                <th>Survey</th>
                <th>Cadence</th>
                <th>Links issued</th>
                <th>Responded</th>
                <th>Participation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {surveyPoints.map((sp) => (
                <tr key={sp._id}>
                  <td>{sp.name}</td>
                  <td className="subtitle">{formatCadence(sp)}</td>
                  <td>{sp.tokensIssued}</td>
                  <td>{sp.tokensUsed}</td>
                  <td>{sp.participationRate !== null ? `${sp.participationRate}%` : "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm" disabled={sendingId === sp._id} onClick={() => sendLinks(sp._id)}>
                      {sendingId === sp._id ? "Sending…" : "Send / resend links"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sendStatus && <p className="subtitle" style={{ marginTop: 8 }}>{sendStatus}</p>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <form className="callout" onSubmit={addSingle}>
          <h3 style={{ marginTop: 0 }}>Add one person</h3>
          <div className="field">
            <label>Work email</label>
            <input
              type="email"
              required
              value={singleEmail}
              onChange={(e) => setSingleEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <div className="field">
            <label>Start date (drives the 30/90-day check-ins)</label>
            <input type="date" value={singleStartDate} onChange={(e) => setSingleStartDate(e.target.value)} />
          </div>
          <button className="btn btn-sm" type="submit" disabled={adding}>
            {adding ? "Adding…" : "Add"}
          </button>
          {addStatus && <p className="subtitle" style={{ marginTop: 8 }}>{addStatus}</p>}
        </form>

        <form className="callout" onSubmit={uploadBulk}>
          <h3 style={{ marginTop: 0 }}>Bulk add</h3>
          <p className="subtitle" style={{ marginTop: 0 }}>
            One person per line: <code>email, start date (YYYY-MM-DD, optional)</code>
          </p>
          <div className="field">
            <textarea
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"amina@company.com, 2026-01-15\nnoah@company.com"}
              style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
            />
          </div>
          <button className="btn btn-sm" type="submit" disabled={bulkUploading}>
            {bulkUploading ? "Uploading…" : "Upload"}
          </button>
          {bulkStatus && <p className="subtitle" style={{ marginTop: 8 }}>{bulkStatus}</p>}
        </form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <form className="callout" onSubmit={markExited}>
          <h3 style={{ marginTop: 0 }}>Mark someone exited</h3>
          <p className="subtitle" style={{ marginTop: 0 }}>Triggers the exit survey on the next daily run.</p>
          <div className="field">
            <label>Work email</label>
            <input type="email" required value={exitEmail} onChange={(e) => setExitEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Exit date (defaults to today)</label>
            <input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
          </div>
          <button className="btn btn-sm" type="submit" disabled={exiting}>
            {exiting ? "Saving…" : "Mark exited"}
          </button>
          {exitStatus && <p className="subtitle" style={{ marginTop: 8 }}>{exitStatus}</p>}
        </form>

        <form className="callout" onSubmit={removeEntry}>
          <h3 style={{ marginTop: 0 }}>Remove a mistaken entry</h3>
          <p className="subtitle" style={{ marginTop: 0 }}>
            For correcting an upload error only — not for offboarding (use &quot;Mark exited&quot; for that).
          </p>
          <div className="field">
            <label>Work email</label>
            <input type="email" required value={removeEmail} onChange={(e) => setRemoveEmail(e.target.value)} />
          </div>
          <button className="btn btn-sm" type="submit" disabled={removing}>
            {removing ? "Removing…" : "Remove"}
          </button>
          {removeStatus && <p className="subtitle" style={{ marginTop: 8 }}>{removeStatus}</p>}
        </form>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="callout" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div className="subtitle" style={{ margin: 0 }}>{label}</div>
    </div>
  );
}
