"use client";

import { useEffect, useState } from "react";
import { QrModal } from "@/components/qr-modal";

interface TemplateQuestion {
  _id: string;
  text: string;
  type: string;
  required: boolean;
}
interface TemplateOption {
  _id: string;
  name: string;
  product: string;
  questions: TemplateQuestion[];
}
interface BranchOption {
  _id: string;
  name: string;
}
interface FeedbackPointRow {
  _id: string;
  businessId: string;
  businessName: string;
  name: string;
  description: string;
  qrToken: string;
  scans: number;
  active: boolean;
  responseQuota: number | null;
}

/**
 * Centralized survey building for a multi-branch org — the Group twin of
 * /business/feedback-points' builder, except a branch is picked first
 * rather than implied by whoever's logged in. Branches never get this
 * capability themselves (see the business route's own comment): the org
 * owner builds here, on behalf of whichever branch needs a new point, so
 * surveys stay consistent across the network instead of drifting branch by
 * branch.
 */
export default function GroupFeedbackPointsClient() {
  const [points, setPoints] = useState<FeedbackPointRow[] | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [qrPoint, setQrPoint] = useState<FeedbackPointRow | null>(null);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [businessId, setBusinessId] = useState("");
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [builderName, setBuilderName] = useState("");
  const [builderDescription, setBuilderDescription] = useState("");
  const [builderQuota, setBuilderQuota] = useState("");
  const [builderSubmitting, setBuilderSubmitting] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

  const selectedTemplate = templates?.find((t) => t._id === templateId) ?? null;

  function load() {
    fetch("/api/group/feedback-points")
      .then((r) => r.json())
      .then((d) => {
        setPoints(d.feedbackPoints ?? []);
        setBranches(d.branches ?? []);
      });
  }

  useEffect(load, []);

  function openBuilder() {
    setBuilderError(null);
    setBuilderOpen(true);
    if (branches.length > 0 && !businessId) setBusinessId(branches[0]._id);
    if (!templates) {
      fetch("/api/group/feedback-points/templates")
        .then((r) => r.json())
        .then((d) => {
          const list: TemplateOption[] = d.templates ?? [];
          setTemplates(list);
          if (list.length > 0) {
            setTemplateId(list[0]._id);
            setSelectedQuestionIds(list[0].questions.map((q) => q._id));
          }
        });
    }
  }

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const t = templates?.find((tt) => tt._id === id);
    setSelectedQuestionIds(t ? t.questions.map((q) => q._id) : []);
  }

  function toggleQuestion(id: string) {
    setSelectedQuestionIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function moveQuestion(id: string, dir: -1 | 1) {
    setSelectedQuestionIds((ids) => {
      const index = ids.indexOf(id);
      const target = index + dir;
      if (index === -1 || target < 0 || target >= ids.length) return ids;
      const copy = [...ids];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  async function submitBuilder() {
    setBuilderError(null);
    if (!businessId) {
      setBuilderError("Pick a branch");
      return;
    }
    if (!builderName.trim()) {
      setBuilderError("Name is required");
      return;
    }
    if (selectedQuestionIds.length === 0) {
      setBuilderError("Pick at least one question");
      return;
    }
    setBuilderSubmitting(true);
    try {
      const res = await fetch("/api/group/feedback-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: builderName.trim(),
          description: builderDescription.trim(),
          templateId,
          selectedQuestionIds,
          responseQuota: builderQuota.trim() ? Number(builderQuota) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "ok") {
        throw new Error(data.message || "Couldn't create this feedback point. Please try again.");
      }
      setBuilderOpen(false);
      setBuilderName("");
      setBuilderDescription("");
      setBuilderQuota("");
      load();
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : "Couldn't create this feedback point. Please try again.");
    } finally {
      setBuilderSubmitting(false);
    }
  }

  if (points === null) return <p className="subtitle">Loading…</p>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Feedback points</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Build and manage every branch's surveys centrally — a branch never builds its own, so the whole network
            stays consistent.
          </p>
        </div>
        <button className="btn btn-dark" onClick={openBuilder} disabled={branches.length === 0}>
          + Build a survey
        </button>
      </div>

      {branches.length === 0 && <p className="subtitle">No branches yet — add a branch before building a survey.</p>}

      {builderOpen && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Build a survey</h3>
          <div className="field" style={{ maxWidth: 420 }}>
            <label>Branch</label>
            <select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          {templates === null && <p className="subtitle">Loading templates…</p>}
          {templates !== null && templates.length === 0 && (
            <p className="subtitle">No survey templates are available on your account yet.</p>
          )}
          {templates !== null && templates.length > 0 && (
            <>
              <div className="field" style={{ maxWidth: 420 }}>
                <label>Name</label>
                <input
                  type="text"
                  value={builderName}
                  onChange={(e) => setBuilderName(e.target.value)}
                  placeholder="e.g. Front Desk QR"
                />
              </div>
              <div className="field" style={{ maxWidth: 420 }}>
                <label>Description (optional)</label>
                <input type="text" value={builderDescription} onChange={(e) => setBuilderDescription(e.target.value)} />
              </div>
              <div className="field" style={{ maxWidth: 420 }}>
                <label>Template</label>
                <select value={templateId} onChange={(e) => chooseTemplate(e.target.value)}>
                  {templates.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplate && (
                <div className="field" style={{ maxWidth: 480 }}>
                  <label>Questions — check the ones to ask, reorder with the arrows</label>
                  {selectedTemplate.questions.map((q) => {
                    const checked = selectedQuestionIds.includes(q._id);
                    const orderIndex = selectedQuestionIds.indexOf(q._id);
                    return (
                      <div
                        key={q._id}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleQuestion(q._id)} />
                        <span style={{ flex: 1, fontSize: 13 }}>
                          {q.text}
                          {q.required && <span style={{ color: "var(--red)" }}> *</span>}
                        </span>
                        {checked && (
                          <>
                            <button className="icon-btn btn-sm" onClick={() => moveQuestion(q._id, -1)} disabled={orderIndex === 0}>
                              ↑
                            </button>
                            <button
                              className="icon-btn btn-sm"
                              onClick={() => moveQuestion(q._id, 1)}
                              disabled={orderIndex === selectedQuestionIds.length - 1}
                            >
                              ↓
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="field" style={{ maxWidth: 260 }}>
                <label>Response quota (optional)</label>
                <input
                  type="number"
                  min={1}
                  value={builderQuota}
                  onChange={(e) => setBuilderQuota(e.target.value)}
                  placeholder="Leave blank for unlimited"
                />
                <div className="field-hint">This point auto-closes once it collects this many responses.</div>
              </div>

              {builderError && <p className="error-text">{builderError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-dark" onClick={submitBuilder} disabled={builderSubmitting}>
                  {builderSubmitting ? "Creating…" : "Create feedback point"}
                </button>
                <button className="btn" onClick={() => setBuilderOpen(false)} disabled={builderSubmitting}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {points.length === 0 ? (
        <p className="subtitle">No feedback points yet — build one above.</p>
      ) : (
        <div className="grid grid-2">
          {points.map((p) => (
            <div className="card" key={p._id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                <span className={`pill ${p.active ? "pill-accent" : "pill-gray"}`}>{p.active ? "Active" : "Inactive"}</span>
              </div>
              <p className="card-sub">{p.businessName}</p>
              {p.description && <p className="card-sub">{p.description}</p>}
              <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 10 }}>{p.scans} scans</div>
              <button className="btn btn-sm" onClick={() => setQrPoint(p)}>
                View QR
              </button>
            </div>
          ))}
        </div>
      )}

      {qrPoint && (
        <QrModal
          name={`${qrPoint.businessName} — ${qrPoint.name}`}
          qrToken={qrPoint.qrToken}
          posterHref={`/print/group-branch-feedback-point/${qrPoint._id}`}
          onClose={() => setQrPoint(null)}
        />
      )}
    </div>
  );
}
