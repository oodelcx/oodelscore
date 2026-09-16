"use client";

import { useEffect, useState } from "react";

interface ContactMessageRow {
  _id: string;
  name: string;
  email: string;
  company: string;
  message: string;
  createdAt: string;
}

export default function ContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/contact-messages")
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setError(data.message ?? "Failed to load messages");
          return;
        }
        setMessages(data.messages ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Contact Messages</h1>
      <p className="subtitle">Every submission from the public /contact page, newest first.</p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="subtitle">Loading…</p>}

      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>From</th>
              <th>Company</th>
              <th>Message</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m._id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{m.name}</div>
                  <div className="subtitle" style={{ fontSize: 12.5 }}>
                    <a href={`mailto:${m.email}`}>{m.email}</a>
                  </div>
                </td>
                <td>{m.company || <span className="subtitle">—</span>}</td>
                <td style={{ maxWidth: 420, whiteSpace: "pre-wrap" }}>{m.message}</td>
                <td>{new Date(m.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {messages.length === 0 && (
              <tr>
                <td colSpan={4} className="subtitle">
                  No messages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
