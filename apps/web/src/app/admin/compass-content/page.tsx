"use client";

import { useEffect, useState } from "react";

interface IndustryRow {
  industry: string;
  numbersOutcomeExamples: string;
  hearingChannelExamples: string;
  ownershipRoleExamples: string;
  rhythmTriggerExample: string;
  hasCustomPack: boolean;
}

export default function CompassContentPage() {
  const [industries, setIndustries] = useState<IndustryRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, IndustryRow>>({});
  const [loading, setLoading] = useState(true);
  const [openIndustry, setOpenIndustry] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [cadenceDraft, setCadenceDraft] = useState("");
  const [savingCadence, setSavingCadence] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/admin/compass-content")
      .then((res) => res.json())
      .then((data) => {
        const list: IndustryRow[] = data.industries ?? [];
        setIndustries(list);
        const next: Record<string, IndustryRow> = {};
        for (const row of list) next[row.industry] = row;
        setDrafts(next);
        setCadenceDraft(data.compassReassessmentCadenceDays != null ? String(data.compassReassessmentCadenceDays) : "");
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function saveCadence() {
    setSavingCadence(true);
    await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compassReassessmentCadenceDays: cadenceDraft.trim() ? Number(cadenceDraft) : null }),
    });
    setSavingCadence(false);
  }

  async function savePack(industry: string) {
    const draft = drafts[industry];
    if (!draft) return;
    setSaving(industry);
    await fetch("/api/admin/compass-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, industry }),
    });
    setSaving(null);
    load();
  }

  function updateField(industry: string, field: keyof IndustryRow, value: string) {
    setDrafts((prev) => ({ ...prev, [industry]: { ...prev[industry], [field]: value } }));
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>OodelCX Compass Content</h1>
          <p className="subtitle">
            Every account answers the same assessment questions and is scored on the same engine — this only edits the
            industry-specific examples interpolated into a few of those questions, plus how often an account is nudged
            to retake it.
          </p>
        </div>
      </div>

      <div className="callout" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Reassessment cadence</h3>
        <p className="subtitle" style={{ marginTop: 0 }}>
          How many days after a completed assessment an account is shown a &quot;due for reassessment&quot; flag. Leave
          blank to turn the nudge off platform-wide.
        </p>
        <div className="field-row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ margin: 0, width: 140 }}>
            <label>Days</label>
            <input type="number" min="1" placeholder="off" value={cadenceDraft} onChange={(e) => setCadenceDraft(e.target.value)} />
          </div>
          <button className="btn btn-dark btn-sm" disabled={savingCadence} onClick={saveCadence}>
            {savingCadence ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Industry</th>
              <th>Content</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {industries.map((row) => (
              <>
                <tr key={row.industry}>
                  <td>{row.industry}</td>
                  <td>
                    <span className={`pill ${row.hasCustomPack ? "pill-green" : "pill-gray"}`}>
                      {row.hasCustomPack ? "Custom pack" : "Default wording"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => setOpenIndustry(openIndustry === row.industry ? null : row.industry)}
                    >
                      {openIndustry === row.industry ? "Close" : "Edit →"}
                    </button>
                  </td>
                </tr>
                {openIndustry === row.industry && (
                  <tr>
                    <td colSpan={3}>
                      <div style={{ margin: "6px 0 14px", padding: 14, background: "var(--bg-2, #f7f7f5)", borderRadius: 8 }}>
                        <div className="field">
                          <label>Outcome examples (measuring impact)</label>
                          <input
                            value={drafts[row.industry]?.numbersOutcomeExamples ?? ""}
                            onChange={(e) => updateField(row.industry, "numbersOutcomeExamples", e.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label>Listening channel examples</label>
                          <input
                            value={drafts[row.industry]?.hearingChannelExamples ?? ""}
                            onChange={(e) => updateField(row.industry, "hearingChannelExamples", e.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label>Ownership role examples</label>
                          <input
                            value={drafts[row.industry]?.ownershipRoleExamples ?? ""}
                            onChange={(e) => updateField(row.industry, "ownershipRoleExamples", e.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label>Rhythm trigger example</label>
                          <input
                            value={drafts[row.industry]?.rhythmTriggerExample ?? ""}
                            onChange={(e) => updateField(row.industry, "rhythmTriggerExample", e.target.value)}
                          />
                        </div>
                        <button className="btn btn-dark btn-sm" disabled={saving === row.industry} onClick={() => savePack(row.industry)}>
                          {saving === row.industry ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {industries.length === 0 && (
              <tr>
                <td colSpan={3} className="subtitle">
                  No industries configured yet — add one on the Industries page first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
