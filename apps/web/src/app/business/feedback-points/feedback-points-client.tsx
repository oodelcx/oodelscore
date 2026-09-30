"use client";

import { useEffect, useState } from "react";
import { QrModal } from "@/components/qr-modal";
import { InfoTip } from "@/components/info-tip";
import { useTooltips } from "@/lib/useTooltips";

interface DemographicConfig {
  name: string;
  email: string;
  phone: string;
  ageGroup: string;
  gender: string;
}

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

interface FeedbackPointRow {
  _id: string;
  name: string;
  description: string;
  qrToken: string;
  scans: number;
  active: boolean;
  hasNps: boolean;
  hasComments: boolean;
  demographics: DemographicConfig;
  templateName: string;
  isTemplateOverridden: boolean;
  effectiveFormLayout: "single_page" | "one_per_screen";
  isLayoutOverridden: boolean;
  eventName: string | null;
}

const LAYOUT_LABELS: Record<string, string> = {
  single_page: "All questions on one screen",
  one_per_screen: "One question per screen",
};

const DEMOGRAPHIC_LABELS: Record<keyof DemographicConfig, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  ageGroup: "Age",
  gender: "Gender",
};

function configBadges(p: FeedbackPointRow) {
  const badges: { label: string; className: string }[] = [
    { label: p.hasNps ? "NPS on" : "NPS off", className: p.hasNps ? "pill-accent" : "pill-gray" },
    { label: p.hasComments ? "Comments on" : "Comments off", className: p.hasComments ? "pill-accent" : "pill-gray" },
  ];
  const demoEntries = (Object.keys(DEMOGRAPHIC_LABELS) as (keyof DemographicConfig)[]).filter(
    (key) => (p.demographics?.[key] ?? "off") !== "off"
  );
  if (demoEntries.length === 0) {
    badges.push({ label: "All demographics off", className: "pill-gray" });
  } else {
    for (const key of demoEntries) {
      const mode = p.demographics[key];
      badges.push({
        label: `${DEMOGRAPHIC_LABELS[key]} ${mode}`,
        className: mode === "mandatory" ? "pill-green" : "pill-amber",
      });
    }
  }
  return badges;
}

export default function FeedbackPointsClient() {
  const tooltips = useTooltips("feedback-points");
  const [points, setPoints] = useState<FeedbackPointRow[]>([]);
  const [isBranch, setIsBranch] = useState(false);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [requestSent, setRequestSent] = useState(false);
  const [qrPoint, setQrPoint] = useState<FeedbackPointRow | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [builderName, setBuilderName] = useState("");
  const [builderDescription, setBuilderDescription] = useState("");
  const [builderQuota, setBuilderQuota] = useState("");
  const [builderSubmitting, setBuilderSubmitting] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

  const selectedTemplate = templates?.find((t) => t._id === templateId) ?? null;

  function openBuilder() {
    setBuilderError(null);
    setBuilderOpen(true);
    if (!templates) {
      fetch("/api/business/feedback-points/templates")
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
      const res = await fetch("/api/business/feedback-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      const pointsRes = await fetch("/api/business/feedback-points").then((r) => r.json());
      setPoints(pointsRes.feedbackPoints ?? []);
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : "Couldn't create this feedback point. Please try again.");
    } finally {
      setBuilderSubmitting(false);
    }
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/business/feedback-points").then((r) => r.json()),
      fetch("/api/business/responses").then((r) => r.json()),
    ]).then(([pointsData, responsesData]) => {
      setPoints(pointsData.feedbackPoints ?? []);
      setIsBranch(!!pointsData.isBranch);
      const counts: Record<string, number> = {};
      for (const r of responsesData.responses ?? []) {
        counts[r.feedbackPointId] = (counts[r.feedbackPointId] ?? 0) + 1;
      }
      setResponseCounts(counts);
      setLoading(false);
    });
  }, []);

  function openRequest() {
    setRequestError(null);
    setRequestOpen(true);
  }

  async function submitRequest() {
    setRequestSubmitting(true);
    setRequestError(null);
    try {
      const res = await fetch("/api/business/feedback-points/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: requestNote.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "ok") {
        throw new Error(data.message || "Couldn't send your request. Please try again.");
      }
      setRequestOpen(false);
      setRequestNote("");
      setRequestSent(true);
      setTimeout(() => setRequestSent(false), 4000);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Couldn't send your request. Please try again.");
    } finally {
      setRequestSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Feedback points</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            View your QR codes and what each one asks customers.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isBranch && (
            <button className="btn btn-dark" onClick={openBuilder}>
              + Build a survey
            </button>
          )}
          <button className="btn" data-tour="fp-request-button" onClick={openRequest}>
            + Request new feedback point
          </button>
          <InfoTip text={tooltips["request-feedback-point"]} />
        </div>
      </div>

      <div className="callout">
        {isBranch ? (
          <>
            Your parent organization builds and manages this branch's surveys centrally, so every branch stays
            consistent — your Group owner does this from their own Feedback Points page. For anything else (a
            brand-new template, a different question type, edits to existing wording), request a change below —
            your account manager actions those within one business day.
          </>
        ) : (
          <>
            Build your own feedback point above by picking a survey template and choosing which of its questions to
            include — the template's question wording and categories are set by OodelCX, but you decide which of
            them to ask and how many responses to collect. For anything else (a brand-new template, a different
            question type, edits to existing wording), request a change below — your account manager actions those
            within one business day.
          </>
        )}
      </div>
      {requestSent && <div className="callout">Your request has been sent — your account manager will be in touch.</div>}

      {builderOpen && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Build a survey</h3>
          {templates === null && <p className="subtitle">Loading templates…</p>}
          {templates !== null && templates.length === 0 && (
            <p className="subtitle">No survey templates are available on your account yet — request one below.</p>
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
                            <button
                              className="icon-btn btn-sm"
                              onClick={() => moveQuestion(q._id, -1)}
                              disabled={orderIndex === 0}
                            >
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

      {requestOpen && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>
            Request a feedback point <InfoTip text={tooltips["request-feedback-point"]} />
          </h3>
          <p className="card-sub">
            Tell your account manager what you need — a new location, an updated question set, anything else.
          </p>
          <textarea
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="Optional note (e.g. which location, what should change)"
            rows={3}
            style={{ width: "100%", marginTop: 8, marginBottom: 8 }}
          />
          {requestError && <p style={{ color: "var(--danger, #c0392b)" }}>{requestError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-dark" onClick={submitRequest} disabled={requestSubmitting}>
              {requestSubmitting ? "Sending…" : "Send request"}
            </button>
            <button
              className="btn"
              onClick={() => {
                setRequestOpen(false);
                setRequestError(null);
              }}
              disabled={requestSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <div className="grid grid-2">
          {points.map((p, index) => {
            const responses = responseCounts[p._id] ?? 0;
            const conversion = p.scans > 0 ? Math.round((responses / p.scans) * 100) : null;
            const isFirst = index === 0;
            return (
              <div className="card" data-tour={isFirst ? "fp-first-card" : undefined} key={p._id}>
                <h3>{p.name}</h3>
                <p className="card-sub">{p.description || "—"}</p>
                <div style={{ display: "flex", gap: 18, fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
                  <div>
                    {p.scans} scans <InfoTip text={tooltips["scans"]} />
                  </div>
                  <div>
                    {responses} responses <InfoTip text={tooltips["responses"]} />
                  </div>
                  <div>
                    <strong style={{ color: "var(--text)" }}>{conversion !== null ? `${conversion}%` : "—"}</strong> conversion{" "}
                    <InfoTip text={tooltips["conversion"]} />
                  </div>
                </div>
                <div className="badge-row">
                  <span className={`pill ${p.active ? "pill-accent" : "pill-gray"}`}>{p.active ? "Active" : "Inactive"}</span>
                  <InfoTip text={tooltips["active-status"]} />
                  {p.eventName && <span className="pill pill-amber">Session: {p.eventName}</span>}
                  {configBadges(p).map((b, i) => (
                    <span className={`pill ${b.className}`} key={i}>
                      {b.label}
                    </span>
                  ))}
                </div>
                <div className="card-sub" style={{ marginTop: 10 }}>
                  <div>
                    <b>Questions:</b> {p.templateName}
                    {p.isTemplateOverridden && " (custom for this point)"}
                  </div>
                  <div>
                    <b>Layout:</b> {LAYOUT_LABELS[p.effectiveFormLayout] ?? p.effectiveFormLayout}
                    {p.isLayoutOverridden && " (custom for this point)"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="btn" data-tour={isFirst ? "fp-first-qr" : undefined} style={{ flex: 1 }} onClick={() => setQrPoint(p)}>
                    View QR
                  </button>
                  <button className="btn" style={{ flex: 1 }} onClick={openRequest}>
                    Request changes
                  </button>
                </div>
              </div>
            );
          })}
          {points.length === 0 && <p className="subtitle">No feedback points yet — request one above.</p>}
        </div>
      )}

      {qrPoint && (
        <QrModal
          name={qrPoint.name}
          qrToken={qrPoint.qrToken}
          posterHref={`/print/business-feedback-point/${qrPoint._id}`}
          onClose={() => setQrPoint(null)}
        />
      )}
    </div>
  );
}
