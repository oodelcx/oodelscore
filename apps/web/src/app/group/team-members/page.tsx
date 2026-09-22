"use client";

import { useEffect, useState } from "react";

interface MemberRow {
  _id: string;
  email: string;
  teamRole: string;
  tier: "full" | "limited";
  inviteStatus: string;
}

export default function GroupTeamMembersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [seatLimit, setSeatLimit] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [tier, setTier] = useState<"full" | "limited">("full");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editTier, setEditTier] = useState<"full" | "limited">("full");

  function load() {
    setLoading(true);
    fetch("/api/group/team-members")
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
    const res = await fetch("/api/group/team-members", {
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
    const res = await fetch(`/api/group/team-members/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  function startEdit(m: MemberRow) {
    setEditingId(m._id);
    setEditRole(m.teamRole);
    setEditTier(m.tier);
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/group/team-members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamRole: editRole, tier: editTier }),
    });
    if (res.ok) {
      setEditingId(null);
      load();
    }
  }

  const atLimit = seatLimit !== null && activeCount >= seatLimit;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Team Members</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Invite people to your Group&rsquo;s own login pool — independent of any branch&rsquo;s team seats.
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
                Need more? <a href="/group/support">Request more seats →</a>
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
            <label>Role (optional)</label>
            <input type="text" value={teamRole} onChange={(e) => setTeamRole(e.target.value)} disabled={atLimit} />
          </div>
          <div className="field">
            <label>Access</label>
            <select value={tier} onChange={(e) => setTier(e.target.value as "full" | "limited")} disabled={atLimit}>
              <option value="full">Full — same as you, minus billing &amp; team management</option>
              <option value="limited">Limited — only their own assigned cases</option>
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
            {members.map((m) =>
              editingId === m._id ? (
                <tr key={m._id}>
                  <td>{m.email}</td>
                  <td>
                    <input value={editRole} onChange={(e) => setEditRole(e.target.value)} placeholder="e.g. Regional Manager" />
                  </td>
                  <td>
                    <select value={editTier} onChange={(e) => setEditTier(e.target.value as "full" | "limited")}>
                      <option value="full">Full</option>
                      <option value="limited">Limited</option>
                    </select>
                  </td>
                  <td>
                    <span className={`pill ${m.inviteStatus === "active" ? "pill-accent" : "pill-gray"}`}>{m.inviteStatus}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm" style={{ marginRight: 8 }} onClick={() => saveEdit(m._id)}>
                      Save
                    </button>
                    <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={m._id}>
                  <td>{m.email}</td>
                  <td>{m.teamRole || "—"}</td>
                  <td>{m.tier === "full" ? "Full" : "Limited"}</td>
                  <td>
                    <span className={`pill ${m.inviteStatus === "active" ? "pill-accent" : "pill-gray"}`}>{m.inviteStatus}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="icon-btn" style={{ marginRight: 4 }} onClick={() => startEdit(m)} title="Edit role/access">
                      ✎
                    </button>
                    <button className="icon-btn btn-danger" onClick={() => remove(m._id)}>
                      🗑
                    </button>
                  </td>
                </tr>
              )
            )}
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
