"use client";

import { useEffect, useState } from "react";

interface TeamRow {
  userId: string;
  label: string;
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
      <p className="subtitle">Every login with access to your organization&apos;s data — used to assign Action Board owners.</p>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Name / business</th>
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
              </tr>
            ))}
            {team.length === 0 && (
              <tr>
                <td className="subtitle">No team members yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
