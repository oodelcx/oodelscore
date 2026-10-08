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
interface TimelineRow {
  kind: string;
  label: string;
  actorLabel: string;
  note: string;
  at: string;
}
interface CommentRow {
  _id: string;
  authorLabel: string;
  body: string;
  createdAt: string;
}
interface AnswerRow {
  questionId: string;
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
interface RecurringFlagSummary {
  _id: string;
  ownerScope: string;
  categoryName: string | null;
  caseCount: number;
  branchCount: number;
}
interface EscalationLevelPreview {
  level: number;
  label: string;
  assigneeEmail: string | null;
}
interface EscalationInfo {
  levelsConfigured: number;
  topLevel: number | null;
  canEscalate: boolean;
  canDeEscalate: boolean;
  nextLevel: EscalationLevelPreview | null;
  prevLevel: EscalationLevelPreview | null;
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
  originatorLabel?: string;
  playbookRun: PlaybookRunSummary | null;
  customerNotifiedAt: string | null;
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
  const [recurringFlag, setRecurringFlag] = useState<RecurringFlagSummary | null>(null);
  const [sourceResponses, setSourceResponses] = useState<ResponseRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [questionTextById, setQuestionTextById] = useState<Record<string, string>>({});
  const [escalation, setEscalation] = useState<EscalationInfo>({
    levelsConfigured: 0,
    topLevel: null,
    canEscalate: false,
    canDeEscalate: false,
    nextLevel: null,
    prevLevel: null,
  });
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalationNote, setEscalationNote] = useState("");
  const [deEscalating, setDeEscalating] = useState(false);
  const [customerMessage, setCustomerMessage] = useState("");
  const [sendingToCustomer, setSendingToCustomer] = useState(false);
  const [customerSendResult, setCustomerSendResult] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/group/action-board/${caseId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to load");
        setItem(data.item);
        setRecurringFlag(data.recurringFlag ?? null);
        setSourceResponses(data.sourceResponses ?? []);
        setComments(data.comments ?? []);
        setTimeline(data.timeline ?? []);
        setQuestionTextById(data.questionTextById ?? {});
        setEscalation(
          data.escalation ?? { levelsConfigured: 0, topLevel: null, canEscalate: false, canDeEscalate: false, nextLevel: null, prevLevel: null }
        );
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

  const [escNotice, setEscNotice] = useState<{ ok: boolean; text: string } | null>(null);

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
      setEscNotice({ ok: false, text: data?.message ?? "Failed to escalate" });
      return;
    }
    setEscalationNote("");
    setEscNotice({ ok: true, text: `Escalated to ${escalation.nextLevel?.label ?? "the next level"}${escalation.nextLevel?.assigneeEmail ? `. It is now with ${escalation.nextLevel.assigneeEmail}.` : "."}` });
    load();
  }

  async function deEscalate() {
    setDeEscalating(true);
    const res = await fetch(`/api/group/action-board/${caseId}/de-escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: escalationNote.trim() }),
    });
    const data = await res.json().catch(() => null);
    setDeEscalating(false);
    if (!res.ok) {
      setEscNotice({ ok: false, text: data?.message ?? "Failed to step back" });
      return;
    }
    setEscalationNote("");
    setEscNotice({ ok: true, text: `Stepped back to ${escalation.prevLevel?.label ?? "the previous level"}.` });
    load();
  }

  async function sendToCustomer() {
    if (!customerMessage.trim()) return;
    setSendingToCustomer(true);
    setCustomerSendResult(null);
    const res = await fetch(`/api/group/action-board/${caseId}/respond-to-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: customerMessage.trim() }),
    });
    const data = await res.json().catch(() => null);
    setSendingToCustomer(false);
    if (!res.ok) {
      setCustomerSendResult(data?.message ?? "Failed to send");
      return;
    }
    setCustomerMessage("");
    load();
  }

  if (loading) return <p className="subtitle">Loading…</p>;
  if (error || !item) return <p className="error-text">{error ?? "Case not found."}</p>;

  const respondentEmail = sourceResponses.find((r) => r.respondentEmail)?.respondentEmail ?? null;

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

      {recurringFlag && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--amber, #b45309)" }}>
          <h3 style={{ margin: "0 0 4px" }}>⚠ This looks like a recurring issue</h3>
          <p className="card-sub" style={{ margin: 0 }}>
            {recurringFlag.categoryName ?? "This category"} has come up {recurringFlag.caseCount} times
            {recurringFlag.branchCount > 1 ? ` across ${recurringFlag.branchCount} branches` : ""} recently.
            {recurringFlag.ownerScope === "parentOrg" ? (
              <>
                {" "}
                <Link href="/group/improvement-initiatives">Turn this into an Improvement Initiative →</Link>
              </>
            ) : (
              " This is flagged for the branch's own Improvement Initiatives."
            )}
          </p>
        </div>
      )}

      {item.description && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Description</h3>
          <p className="card-sub">{item.description}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Original feedback</h3>
        {sourceResponses.length === 0 && <p className="subtitle">{item.description ? "This case was raised from a pattern of feedback rather than one survey response — the respondent's words are in the description above." : "No linked feedback response."}</p>}
        {sourceResponses.map((r) => (
          <div key={r._id} style={{ marginBottom: 12 }}>
            <p className="card-sub" style={{ margin: "0 0 6px" }}>
              {r.respondentName ?? "Anonymous"} — {new Date(r.submittedAt).toLocaleString()}
            </p>
            <table className="clean">
              <tbody>
                {r.answers.map((a, i) => (
                  <tr key={i}>
                    <td>{questionTextById[a.questionId] ?? a.type}</td>
                    <td style={{ textAlign: "right" }}>{Array.isArray(a.value) ? a.value.join(", ") : String(a.value)}</td>
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
        <h3>Case timeline</h3>
        <p style={{ margin: "0 0 8px", fontSize: 13 }}>
          <b>Raised by:</b> {item.originatorLabel || "Not recorded (older case)"}
          {item.escalationHistory.length > 0 && (
            <> — passed up {item.escalationHistory.filter((h) => h.action !== "de_escalated").length} time(s); the full path is below.</>
          )}
        </p>
        <p className="card-sub" style={{ margin: "0 0 8px" }}>
          Every status, priority, owner, and escalation change this case has been through, in order — append-only,
          never edited after the fact.
        </p>
        {timeline.length === 0 ? (
          <p className="subtitle">No changes recorded yet — still exactly as it was created.</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {timeline.map((t, i) => (
              <li key={i} style={{ marginBottom: 6, fontSize: 13 }}>
                {t.label} — <span style={{ color: "var(--text-2)" }}>{t.actorLabel}</span>
                {t.note ? `: ${t.note}` : ""} <span style={{ color: "var(--text-3)" }}>({new Date(t.at).toLocaleString()})</span>
              </li>
            ))}
          </ul>
        )}
        {escNotice && (
          <p className={escNotice.ok ? "callout" : "error-text"} role="status" style={{ marginTop: 10 }}>
            {escNotice.text}
          </p>
        )}
        {item.status !== "resolved" && (
          <div style={{ marginTop: 10 }}>
            {escalation.levelsConfigured <= 1 ? (
              <p className="subtitle" style={{ margin: 0 }}>
                No escalation chain is configured for this account beyond the owner — there is nowhere to escalate
                to or de-escalate from yet. An Admin can add further levels under Accounts → Escalation Workflow.
              </p>
            ) : (
              <>
                {escalation.canEscalate && escalation.nextLevel && (
                  <p className="subtitle" style={{ margin: "0 0 8px" }}>
                    {escalation.nextLevel.assigneeEmail ? (
                      <>
                        Escalating sends this to <b>{escalation.nextLevel.assigneeEmail}</b> ({escalation.nextLevel.label}).
                      </>
                    ) : (
                      <span className="error-text">
                        No one is assigned to {escalation.nextLevel.label} yet — escalating will move the level but won&apos;t
                        notify anyone until an Admin fills it in.
                      </span>
                    )}
                  </p>
                )}
                <div className="field" style={{ maxWidth: 480 }}>
                  <label>Note (optional)</label>
                  <textarea value={escalationNote} onChange={(e) => setEscalationNote(e.target.value)} />
                </div>
                <div className="btn-group">
                  <button className="btn btn-sm" disabled={escalating || !escalation.canEscalate} onClick={escalate}>
                    {escalating
                      ? "Escalating…"
                      : escalation.canEscalate
                        ? `↑ Escalate to ${escalation.nextLevel?.label ?? "next level"}`
                        : "↑ Already at the top level"}
                  </button>
                  {escalation.canDeEscalate && (
                    <button className="btn btn-sm" disabled={deEscalating} onClick={deEscalate}>
                      {deEscalating
                        ? "De-escalating…"
                        : `↓ De-escalate to ${escalation.prevLevel?.label ?? "previous level"}${escalation.prevLevel?.assigneeEmail ? ` (${escalation.prevLevel.assigneeEmail})` : ""}`}
                    </button>
                  )}
                </div>
              </>
            )}
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

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Close the loop with the customer</h3>
        {respondentEmail ? (
          <>
            <p className="card-sub">
              Sends to {respondentEmail} from {businessName ?? "the branch"}&apos;s name — replies land in the branch&apos;s
              own contact inbox, not here.
              {item.customerNotifiedAt && (
                <> Already messaged {new Date(item.customerNotifiedAt).toLocaleString()}.</>
              )}
            </p>
            <div className="field">
              <textarea
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value)}
                placeholder="e.g. Thanks for flagging the wait time — we've added a second till at peak hours."
              />
            </div>
            {customerSendResult && <p className="error-text">{customerSendResult}</p>}
            <button className="btn btn-dark btn-sm" disabled={sendingToCustomer || !customerMessage.trim()} onClick={sendToCustomer}>
              {sendingToCustomer ? "Sending…" : "Send to customer"}
            </button>
          </>
        ) : (
          <p className="subtitle">
            No email was captured for this feedback, so there&apos;s no way to reach this customer personally.
          </p>
        )}
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
