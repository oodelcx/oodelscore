"use client";

import type { ReactNode } from "react";

/**
 * A right-side slide-in panel for a record's full detail — the compact
 * card grid it's paired with only ever shows a summary, so clicking a card
 * opens this instead of expanding the card in place. Keeps the list behind
 * it in view and in the same scroll position, unlike navigating to a
 * separate detail page.
 */
export function DetailDrawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="detail-drawer-backdrop" onClick={onClose}>
      <div className="detail-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="detail-drawer-head">
          <div className="detail-drawer-title">{title}</div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="detail-drawer-body">{children}</div>
      </div>
    </div>
  );
}

interface NoteRow {
  text: string;
  authorLabel: string;
  createdAt: string;
}

/** The append-only note thread shown at the bottom of a detail drawer. */
export function NotesThread({
  notes,
  draft,
  onDraftChange,
  onSubmit,
  submitting,
}: {
  notes: NoteRow[];
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="notes-thread">
      <h3 style={{ margin: "0 0 8px", fontSize: 13 }}>Notes</h3>
      {notes.length === 0 && <p className="subtitle" style={{ margin: "0 0 10px" }}>No notes yet.</p>}
      {notes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {notes.map((n, i) => (
            <div key={i} style={{ borderLeft: "2px solid var(--border)", paddingLeft: 10 }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{n.text}</p>
              <p className="subtitle" style={{ margin: "2px 0 0", fontSize: 11 }}>
                {n.authorLabel} · {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="field-row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Add a note…"
            style={{ resize: "vertical" }}
          />
        </div>
        <button className="btn btn-sm btn-dark" disabled={submitting || !draft.trim()} onClick={onSubmit}>
          {submitting ? "Adding…" : "Add note"}
        </button>
      </div>
    </div>
  );
}
