"use client";

import { useEffect, useState } from "react";

interface TeamRow {
  userId: string;
  label: string;
  role: string;
  access: string;
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/group/team")
      .then((res) => res.json())
      .then((data) => setTeam(data.team ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Team &amp; access</h1>
      <p className="subtitle">Who can see network data, and how much — used to assign Case Management owners.</p>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {team.map((t) => (
              <tr key={t.userId}>
                <td>
                  <div className="row-flex">
                    <div className="avatar">{t.label.slice(0, 2).toUpperCase()}</div>
                    {t.label}
                  </div>
                </td>
                <td>{t.role}</td>
                <td>{t.access}</td>
              </tr>
            ))}
            {team.length === 0 && (
              <tr>
                <td colSpan={3} className="subtitle">
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
