"use client";

import { useEffect, useState } from "react";

interface MemberRow {
  _id: string;
  email: string;
  teamRole: string;
  tier: "full" | "limited";
  inviteStatus: string;
}

export default function BusinessTeamMembersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [seatLimit, setSeatLimit] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [tier, setTier] = useState<"full" | "limited">("full");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/business/team-members")
      .then((res) => res.json())
      .then((data) => {
        setMembers(data.members ?? []);
        setSeatLimit(data.seatLimit ?? null);
        setActiveCount(data.activeCount ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function invite() {
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    const res = await fetch("/api/business/team-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, teamRole, tier }),
    });
    const data = await res.json().catch(() => null);
    setInviting(false);
    if (!res.ok) {
      setError(data?.message ?? "Failed to invite");
      return;
    }
    setEmail("");
    setTeamRole("");
    setTier("full");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this team member's access?")) return;
    const res = await fetch(`/api/business/team-members/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const atLimit = seatLimit !== null && activeCount >= seatLimit;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Team Members</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Invite people at your business to Oodel Score, each with their own login.
          </p>
        </div>
      </div>

      <div className="callout" style={{ marginBottom: 20 }}>
        {seatLimit === null ? (
          <>Unlimited team seats on your plan.</>
        ) : (
          <>
            {activeCount} of {seatLimit} team seats used.{" "}
            {atLimit && (
              <>
                Need more? <a href="/business/messages">Request more seats →</a>
              </>
            )}
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Invite a team member</h3>
        <div className="field-row">
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={atLimit} />
          </div>
          <div className="field">
            <label>Role (optional, e.g. &ldquo;Shift Lead&rdquo;)</label>
            <input type="text" value={teamRole} onChange={(e) => setTeamRole(e.target.value)} disabled={atLimit} />
          </div>
          <div className="field">
            <label>Access</label>
            <select value={tier} onChange={(e) => setTier(e.target.value as "full" | "limited")} disabled={atLimit}>
              <option value="full">Full — same as you, minus billing &amp; team management</option>
              <option value="limited">Limited — only their own assigned Action Board items</option>
            </select>
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={inviting || atLimit} onClick={invite}>
          {inviting ? "Inviting…" : "+ Invite team member"}
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Access</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m._id}>
                <td>{m.email}</td>
                <td>{m.teamRole || "—"}</td>
                <td>{m.tier === "full" ? "Full" : "Limited"}</td>
                <td>
                  <span className={`pill ${m.inviteStatus === "active" ? "pill-accent" : "pill-gray"}`}>{m.inviteStatus}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="icon-btn btn-danger" onClick={() => remove(m._id)}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="subtitle">
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
