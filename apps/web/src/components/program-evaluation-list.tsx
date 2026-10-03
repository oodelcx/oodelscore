"use client";

import { useState } from "react";

export interface ProgramEvaluationEventRow {
  _id: string;
  name: string;
  location: string;
  startsAt: string | null;
  endsAt: string | null;
  programDetails: { synopsis: string; objectives: string[]; expectedOutcomes: string[] } | null;
}
export interface ProgramEvaluationObjectiveMatch {
  objective: string;
  verdict: "met" | "partially_met" | "not_supported";
  evidence: string;
}
export interface ProgramEvaluationReportRow {
  status: "insufficient_data" | "completed";
  responseCount: number;
  starAverage: number | null;
  npsScore: number | null;
  ageGroupCuts: { label: string; responseCount: number; starAverage: number | null }[];
  genderCuts: { label: string; responseCount: number; starAverage: number | null }[];
  topThemes: string[];
  summary: string;
  objectiveMatches: ProgramEvaluationObjectiveMatch[];
  suggestions: string[];
  newAreasToExplore: string[];
  generatedByAi: boolean;
  generatedAt: string;
}
export interface ProgramEvaluationItem {
  event: ProgramEvaluationEventRow;
  branchName?: string;
  report: ProgramEvaluationReportRow | null;
}

const VERDICT_LABEL: Record<ProgramEvaluationObjectiveMatch["verdict"], string> = {
  met: "Met",
  partially_met: "Partially met",
  not_supported: "Not supported by evidence",
};
const VERDICT_PILL: Record<ProgramEvaluationObjectiveMatch["verdict"], string> = {
  met: "pill-green",
  partially_met: "pill-amber",
  not_supported: "pill-gray",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  return (
    <div>
      {items.map((item, i) => (
        <div className="field-row" key={i} style={{ marginBottom: 6 }}>
          <input
            style={{ flex: 1 }}
            value={item}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button className="icon-btn btn-danger" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
            🗑
          </button>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => onChange([...items, ""])}>
        + Add
      </button>
    </div>
  );
}

export function ProgramEvaluationList({
  items,
  showBranch,
  allowEditDetails = true,
  onSaveDetails,
  onRerun,
}: {
  items: ProgramEvaluationItem[];
  showBranch: boolean;
  // A Group can view and re-run a branch's evaluation, but program
  // details (synopsis/objectives) are the branch's own training content —
  // only the branch itself edits them, same as the business-only PATCH
  // route this maps to (see /api/business/events/[eventId]).
  allowEditDetails?: boolean;
  onSaveDetails: (eventId: string, details: { synopsis: string; objectives: string[]; expectedOutcomes: string[] }) => Promise<void>;
  onRerun: (eventId: string) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, { synopsis: string; objectives: string[]; expectedOutcomes: string[] }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function draftFor(item: ProgramEvaluationItem) {
    return (
      drafts[item.event._id] ?? {
        synopsis: item.event.programDetails?.synopsis ?? "",
        objectives: item.event.programDetails?.objectives ?? [],
        expectedOutcomes: item.event.programDetails?.expectedOutcomes ?? [],
      }
    );
  }

  if (items.length === 0) {
    return <p className="subtitle">No training events yet. Mark an Event as &quot;Training&quot; to see it here.</p>;
  }

  return (
    <div>
      {items.map((item) => {
        const draft = draftFor(item);
        const isOpen = expanded[item.event._id] ?? !item.event.programDetails?.synopsis;
        return (
          <div className="card" style={{ marginBottom: 16 }} key={item.event._id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0 }}>{item.event.name}</h3>
                <p className="card-sub" style={{ margin: "4px 0 0" }}>
                  {showBranch && item.branchName ? `${item.branchName} · ` : ""}
                  {formatDate(item.event.startsAt)} – {formatDate(item.event.endsAt)}
                  {item.event.location ? ` · ${item.event.location}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {item.report && (
                  <span className={`pill ${item.report.status === "completed" ? "pill-green" : "pill-gray"}`}>
                    {item.report.status === "completed" ? "Evaluated" : "Insufficient data"}
                  </span>
                )}
                <button className="btn btn-sm" onClick={() => setExpanded((prev) => ({ ...prev, [item.event._id]: !isOpen }))}>
                  {isOpen ? "Collapse" : "Expand"}
                </button>
              </div>
            </div>

            {isOpen && (
              <>
                <div style={{ marginTop: 14 }}>
                  {allowEditDetails ? (
                    <>
                      <div className="field">
                        <label>Synopsis — what this training was about</label>
                        <textarea
                          value={draft.synopsis}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [item.event._id]: { ...draft, synopsis: e.target.value } }))}
                          rows={3}
                        />
                      </div>
                      <div className="field">
                        <label>Objectives</label>
                        <ListEditor
                          items={draft.objectives}
                          placeholder="e.g. Participants can apply the technique independently"
                          onChange={(objectives) => setDrafts((prev) => ({ ...prev, [item.event._id]: { ...draft, objectives } }))}
                        />
                      </div>
                      <div className="field">
                        <label>Expected outcomes</label>
                        <ListEditor
                          items={draft.expectedOutcomes}
                          placeholder="e.g. Higher confidence scores on follow-up"
                          onChange={(expectedOutcomes) => setDrafts((prev) => ({ ...prev, [item.event._id]: { ...draft, expectedOutcomes } }))}
                        />
                      </div>
                      <button
                        className="btn btn-dark btn-sm"
                        disabled={saving === item.event._id}
                        onClick={async () => {
                          setSaving(item.event._id);
                          await onSaveDetails(item.event._id, draft);
                          setSaving(null);
                        }}
                      >
                        {saving === item.event._id ? "Saving…" : "Save program details"}
                      </button>
                    </>
                  ) : (
                    <>
                      {draft.synopsis && <p style={{ marginTop: 0 }}>{draft.synopsis}</p>}
                      {draft.objectives.length > 0 && (
                        <>
                          <p className="card-sub" style={{ marginBottom: 2 }}>
                            Objectives
                          </p>
                          <ul style={{ marginTop: 0 }}>
                            {draft.objectives.map((o, i) => (
                              <li key={i}>{o}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {draft.synopsis === "" && draft.objectives.length === 0 && (
                        <p className="subtitle">This branch hasn&apos;t entered program details for this training yet.</p>
                      )}
                    </>
                  )}
                  <button
                    className="btn btn-sm"
                    disabled={rerunning === item.event._id}
                    onClick={async () => {
                      setRerunning(item.event._id);
                      await onRerun(item.event._id);
                      setRerunning(null);
                    }}
                  >
                    {rerunning === item.event._id ? "Running…" : item.report ? "Re-run evaluation" : "Run evaluation now"}
                  </button>
                </div>

                {item.report && item.report.status === "insufficient_data" && (
                  <p className="subtitle" style={{ marginTop: 14 }}>
                    {item.report.responseCount} response{item.report.responseCount === 1 ? "" : "s"} so far — not enough yet to evaluate
                    against objectives.
                  </p>
                )}

                {item.report && item.report.status === "completed" && (
                  <div style={{ marginTop: 16, borderTop: "1px solid var(--border, #e5e5e0)", paddingTop: 14 }}>
                    <p className="card-sub" style={{ marginTop: 0 }}>
                      {item.report.responseCount} responses
                      {item.report.starAverage !== null ? ` · ${item.report.starAverage}★ average` : ""}
                      {item.report.npsScore !== null ? ` · NPS ${item.report.npsScore}` : ""}
                      {!item.report.generatedByAi ? " · AI analysis unavailable, showing raw numbers only" : ""}
                    </p>
                    <p>{item.report.summary}</p>

                    {item.report.objectiveMatches.length > 0 && (
                      <>
                        <h4 style={{ marginBottom: 6 }}>Objectives vs. the evidence</h4>
                        {item.report.objectiveMatches.map((m, i) => (
                          <div className="qrow" key={i}>
                            <div className="qrow-top">
                              <span style={{ flex: 1, fontWeight: 600 }}>{m.objective}</span>
                              <span className={`pill ${VERDICT_PILL[m.verdict]}`}>{VERDICT_LABEL[m.verdict]}</span>
                            </div>
                            <p className="card-sub" style={{ margin: "4px 0 0" }}>
                              {m.evidence}
                            </p>
                          </div>
                        ))}
                      </>
                    )}

                    {item.report.suggestions.length > 0 && (
                      <>
                        <h4 style={{ marginBottom: 6 }}>Suggestions</h4>
                        <ul style={{ marginTop: 0 }}>
                          {item.report.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </>
                    )}

                    {item.report.newAreasToExplore.length > 0 && (
                      <>
                        <h4 style={{ marginBottom: 6 }}>New areas to explore</h4>
                        <ul style={{ marginTop: 0 }}>
                          {item.report.newAreasToExplore.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </>
                    )}

                    {(item.report.ageGroupCuts.length > 0 || item.report.genderCuts.length > 0) && (
                      <>
                        <h4 style={{ marginBottom: 6 }}>Demographic breakdown</h4>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {item.report.ageGroupCuts.map((c) => (
                            <span className="pill pill-gray" key={`age-${c.label}`}>
                              {c.label}: {c.responseCount}{c.starAverage !== null ? ` · ${c.starAverage}★` : ""}
                            </span>
                          ))}
                          {item.report.genderCuts.map((c) => (
                            <span className="pill pill-gray" key={`gender-${c.label}`}>
                              {c.label}: {c.responseCount}{c.starAverage !== null ? ` · ${c.starAverage}★` : ""}
                            </span>
                          ))}
                        </div>
                      </>
                    )}

                    {item.report.topThemes.length > 0 && (
                      <>
                        <h4 style={{ marginBottom: 6, marginTop: 12 }}>Recurring themes</h4>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {item.report.topThemes.map((t) => (
                            <span className="pill pill-gray" key={t}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
