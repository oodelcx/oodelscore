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

  useEffect(() => {
    fetch("/api/business/team-members")
      .then((res) => res.json())
      .then((data) => {
        setMembers(data.members ?? []);
        setSeatLimit(data.seatLimit ?? null);
        setActiveCount(data.activeCount ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Team Members</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Everyone at your business with their own OodelCX login.
          </p>
        </div>
      </div>

      <div className="callout" style={{ marginBottom: 20 }}>
        {seatLimit === null ? <>Unlimited team seats on your plan.</> : <>{activeCount} of {seatLimit} team seats used.</>}{" "}
        Adding, removing, or changing a team member&apos;s access is handled by OodelCX Admin — <a href="/business/support">raise a support ticket →</a>{" "}
        to request a change and we&apos;ll set it up.
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
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="subtitle">
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
