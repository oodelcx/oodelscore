"use client";

import { useState } from "react";

function formatEndsAt(endsAt: string | null): string {
  if (!endsAt) return "Ongoing — no expiry set";
  const date = new Date(endsAt);
  return `Expires ${date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
}

/**
 * Lets the owner set, change, or clear a feedback point's `endsAt` — the
 * one field self-service even for a branch's own view of the control (the
 * PATCH itself still routes to whichever endpoint owns that point; see the
 * business/group route comments). Clearing it back to blank makes a dated
 * QR/link ongoing again, same as it would have been by never setting one.
 */
export function FeedbackPointExpiry({
  apiPath,
  endsAt,
  onUpdated,
}: {
  apiPath: string;
  endsAt: string | null;
  onUpdated: (endsAt: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(endsAt ? endsAt.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextEndsAt: string | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endsAt: nextEndsAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "ok") throw new Error(data.message || "Couldn't update the expiry date.");
      onUpdated(data.feedbackPoint?.endsAt ?? nextEndsAt);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the expiry date.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-2)", marginTop: 6 }}>
        <span>{formatEndsAt(endsAt)}</span>
        <button
          type="button"
          style={{ fontSize: 12.5, background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
          onClick={() => {
            setValue(endsAt ? endsAt.slice(0, 10) : "");
            setError(null);
            setEditing(true);
          }}
        >
          {endsAt ? "Change" : "Set expiry"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="date" value={value} onChange={(e) => setValue(e.target.value)} style={{ fontSize: 12.5, padding: "4px 6px" }} />
        <button type="button" className="btn btn-sm" disabled={saving || !value} onClick={() => save(new Date(value).toISOString())}>
          {saving ? "Saving…" : "Save"}
        </button>
        {endsAt && (
          <button type="button" className="btn btn-sm" disabled={saving} onClick={() => save(null)}>
            Make ongoing
          </button>
        )}
        <button
          type="button"
          style={{ fontSize: 12.5, background: "none", border: "none", padding: 0, color: "var(--text-3)", cursor: "pointer", textDecoration: "underline" }}
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
      <p className="field-hint" style={{ margin: 0 }}>
        Leave blank and cancel to keep this QR/link ongoing forever — only set a date if this one should stop working on its own.
      </p>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
