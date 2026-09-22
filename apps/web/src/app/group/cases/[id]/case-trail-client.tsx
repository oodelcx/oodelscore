"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface EscalationHistoryRow {
  level: number;
  action: string;
  note: string;
  at: string;
  userEmail: string | null;
}
interface CommentRow {
  _id: string;
  authorLabel: string;
  body: string;
  createdAt: string;
}
interface AnswerRow {
  type: string;
  value: unknown;
}
interface ResponseRow {
  _id: string;
  answers: AnswerRow[];
  respondentName: string | null;
  respondentEmail: string | null;
  submittedAt: string;
}
interface PlaybookRunSummary {
  playbookTitle: string;
  stepsTotal: number;
  stepsCompleted: number;
  status: string;
}
interface CaseDetail {
  _id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  caseType: string;
  resolutionNote: string;
  resolvedAt: string | null;
  createdAt: string;
  currentEscalationLevel: number;
  escalationHistory: EscalationHistoryRow[];
  playbookRun: PlaybookRunSummary | null;
}

const CASE_TYPE_LABELS: Record<string, string> = {
  customer_recovery: "Customer recovery",
  operational_fix: "Operational fix",
  investigation: "Investigation",
};

/**
 * The org-scoped twin of the Business case trail — same shape, but Group
 * is read-only on resolution (branch's job), only comment/escalate here.
 */
export default function GroupCaseTrailClient({ caseId }: { caseId: string }) {
  const [item, setItem] = useState<CaseDetail | null>(null);
  const [sourceResponses, setSourceResponses] = useState<ResponseRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalationNote, setEscalationNote] = useState("");

  function load() {
    setLoading(true);
    fetch(`/api/group/action-board/${caseId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to load");
        setItem(data.item);
        setSourceResponses(data.sourceResponses ?? []);
        setComments(data.comments ?? []);
        setBusinessName(data.businessName ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function postComment() {
    if (!commentDraft.trim()) return;
    setPosting(true);
    await fetch(`/api/group/action-board/${caseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentDraft.trim() }),
    });
    setCommentDraft("");
    setPosting(false);
    load();
  }

  async function escalate() {
    setEscalating(true);
    const res = await fetch(`/api/group/action-board/${caseId}/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: escalationNote.trim() }),
    });
    const data = await res.json().catch(() => null);
    setEscalating(false);
    if (!res.ok) {
      alert(data?.message ?? "Failed to escalate");
      return;
    }
    setEscalationNote("");
    load();
  }

  if (loading) return <p className="subtitle">Loading…</p>;
  if (error || !item) return <p className="error-text">{error ?? "Case not found."}</p>;

  return (
    <div>
      <Link href="/group/cases" className="subtitle" style={{ display: "inline-block", marginBottom: 10 }}>
        ← Back to Case Management
      </Link>
      <div className="page-head">
        <div>
          <h1>{item.title}</h1>
          {businessName && <p className="subtitle">Branch: {businessName}</p>}
          <div className="ab-badges" style={{ marginTop: 6 }}>
            <span className={`pill ${item.status === "resolved" ? "pill-green" : "pill-amber"}`}>{item.status.replace(/_/g, " ")}</span>
            <span className={`pill pill-${item.priority === "critical" || item.priority === "high" ? "amber" : "gray"}`}>{item.priority}</span>
            {item.caseType && <span className="pill pill-gray">{CASE_TYPE_LABELS[item.caseType] ?? item.caseType}</span>}
            {item.currentEscalationLevel > 1 && <span className="pill pill-amber">Escalation level {item.currentEscalationLevel}</span>}
          </div>
        </div>
      </div>

      {item.description && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Description</h3>
          <p className="card-sub">{item.description}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Original feedback</h3>
        {sourceResponses.length === 0 && <p className="subtitle">No linked feedback response.</p>}
        {sourceResponses.map((r) => (
          <div key={r._id} style={{ marginBottom: 12 }}>
            <p className="card-sub" style={{ margin: "0 0 6px" }}>
              {r.respondentName ?? "Anonymous"} — {new Date(r.submittedAt).toLocaleString()}
            </p>
            <table className="clean">
              <tbody>
                {r.answers.map((a, i) => (
                  <tr key={i}>
                    <td>{a.type}</td>
                    <td style={{ textAlign: "right" }}>{String(a.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {item.playbookRun && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Linked playbook</h3>
          <p className="card-sub">
            {item.playbookRun.playbookTitle} — {item.playbookRun.stepsCompleted} of {item.playbookRun.stepsTotal} steps (
            {item.playbookRun.status})
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Escalation trail</h3>
        {item.escalationHistory.length === 0 ? (
          <p className="subtitle">Still at level 1 — hasn't been escalated.</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {item.escalationHistory.map((h, i) => (
              <li key={i} style={{ marginBottom: 6, fontSize: 13 }}>
                Level {h.level} ({h.userEmail ?? "unassigned"}) → escalated{h.note ? `: ${h.note}` : ""} —{" "}
                {new Date(h.at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
        {item.status !== "resolved" && (
          <div style={{ marginTop: 10 }}>
            <div className="field" style={{ maxWidth: 480 }}>
              <label>Escalation note (optional)</label>
              <textarea value={escalationNote} onChange={(e) => setEscalationNote(e.target.value)} />
            </div>
            <button className="btn btn-sm" disabled={escalating} onClick={escalate}>
              {escalating ? "Escalating…" : "↑ Escalate to next level"}
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Comments</h3>
        {comments.length === 0 && <p className="subtitle">No comments yet.</p>}
        <ul style={{ margin: "0 0 10px", paddingLeft: 0, listStyle: "none" }}>
          {comments.map((c) => (
            <li key={c._id} style={{ marginBottom: 8, fontSize: 13 }}>
              <b>{c.authorLabel}</b> <span style={{ color: "var(--text-3)" }}>{new Date(c.createdAt).toLocaleString()}</span>
              <div style={{ color: "var(--text-2)" }}>{c.body}</div>
            </li>
          ))}
        </ul>
        <div className="field-row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <textarea placeholder="Add a note…" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} />
          </div>
          <button className="btn btn-sm btn-dark" disabled={posting || !commentDraft.trim()} onClick={postComment}>
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Resolution</h3>
        <p className="card-sub">
          {item.status === "resolved"
            ? `Resolved ${item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : ""} — ${item.resolutionNote || "(no note)"}`
            : "Not yet resolved — resolving a case is the branch's own job, from its Case Management."}
        </p>
      </div>
    </div>
  );
}
