"use client";

import { useEffect, useState } from "react";

interface MessagesData {
  accountManager: { email: string } | null;
}

function initials(text: string): string {
  return text
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export default function GroupMessagesPage() {
  const [data, setData] = useState<MessagesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/group/messages")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="subtitle">Loading…</p>;

  return (
    <div>
      <h1>Messages</h1>
      <p className="subtitle">Your point of contact at Oodel Score.</p>

      {data?.accountManager ? (
        <div className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="avatar teal">{initials(data.accountManager.email)}</div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13.5 }}>{data.accountManager.email}</div>
            <div style={{ fontSize: 12, color: "var(--text-2)" }}>Your Oodel Score account manager</div>
          </div>
        </div>
      ) : (
        <div className="card empty">
          <div className="icon">💬</div>
          <div style={{ fontWeight: 500, color: "var(--text)" }}>No account manager assigned yet</div>
        </div>
      )}
    </div>
  );
}
