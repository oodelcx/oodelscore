"use client";

import { useEffect, useState } from "react";

interface EscalationLevel {
  level: number;
  label: string;
}
interface Candidate {
  email: string;
  label: string;
}
interface AssignmentRow {
  _id: string;
  level: number;
  region: string;
  businessId: string | null;
  userId: { email: string } | string;
}
interface BranchOption {
  id: string;
  name: string;
  region: string;
}

/**
 * Shared by Group and Business — same two concerns either way: what the
 * chain's rungs are called (+ the SLA that auto-escalates a stalled case),
 * and who holds each rung 2+ right now. Level 1 is always the owner's own
 * login and is never editable here. `regions` is only passed by the Group
 * page (a standalone business has nothing to regionalize).
 */
export function EscalationSettingsClient({
  apiPath,
  regions,
}: {
  apiPath: string;
  regions?: string[];
}) {
  const [levels, setLevels] = useState<EscalationLevel[] | null>(null);
  // Levels as last saved: a holder can only be set on a level that already exists on the server.
  const [savedLevelNumbers, setSavedLevelNumbers] = useState<number[]>([]);
  const [holderError, setHolderError] = useState<string | null>(null);
  const [slaHours, setSlaHours] = useState<string>("");
  const [savingLevels, setSavingLevels] = useState(false);
  const [levelsError, setLevelsError] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>(regions ?? []);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [newLevel, setNewLevel] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newScope, setNewScope] = useState<"org" | "region" | "branch">("org");
  const [newRegion, setNewRegion] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(apiPath)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        setLevels(d.escalationLevels);
        setSavedLevelNumbers((d.escalationLevels as EscalationLevel[]).map((l) => l.level));
        setSlaHours(d.escalationSlaHours !== null ? String(d.escalationSlaHours) : "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
    fetch(`${apiPath}/assignments`)
      .then((r) => r.json())
      .then((d) => {
        setAssignments(d.assignments ?? []);
        setCandidates(d.candidates ?? []);
        if (d.regions) setAvailableRegions(d.regions);
        if (d.branches) setBranches(d.branches);
      });
  }

  useEffect(load, [apiPath]);

  function updateLevelLabel(level: number, label: string) {
    setLevels((prev) => (prev ? prev.map((l) => (l.level === level ? { ...l, label } : l)) : prev));
  }

  function addLevel() {
    setLevels((prev) => {
      const next = prev ?? [];
      const nextLevel = next.length === 0 ? 1 : Math.max(...next.map((l) => l.level)) + 1;
      return [...next, { level: nextLevel, label: nextLevel === 1 ? "Owner" : `Level ${nextLevel}` }];
    });
  }

  function removeLevel(level: number) {
    if (level === 1) return;
    setLevels((prev) => (prev ? prev.filter((l) => l.level !== level) : prev));
  }

  async function saveLevels() {
    if (!levels) return;
    setSavingLevels(true);
    setLevelsError(null);
    const res = await fetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        escalationLevels: levels,
        escalationSlaHours: slaHours.trim() ? Number(slaHours) : null,
      }),
    });
    const data = await res.json().catch(() => null);
    setSavingLevels(false);
    if (!res.ok) {
      setLevelsError(data?.message ?? "Failed to save");
      return;
    }
    load();
  }

  async function addAssignment() {
    if (!newLevel || !newEmail) return;
    if (newScope === "region" && !newRegion) return;
    if (newScope === "branch" && !newBranchId) return;
    setSavingAssignment(true);
    setAssignmentError(null);
    const res = await fetch(`${apiPath}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: Number(newLevel),
        email: newEmail,
        region: newScope === "region" ? newRegion : "",
        businessId: newScope === "branch" ? newBranchId : null,
      }),
    });
    const data = await res.json().catch(() => null);
    setSavingAssignment(false);
    if (!res.ok) {
      setAssignmentError(data?.message ?? "Failed to add assignment");
      return;
    }
    setNewLevel("");
    setNewEmail("");
    setNewScope("org");
    setNewRegion("");
    setNewBranchId("");
    load();
  }

  /** The org-wide holder of a level: the assignment with no region and no branch. */
  function orgWideHolder(level: number): string {
    const a = assignments.find((x) => x.level === level && !x.region && !x.businessId);
    if (!a) return "";
    return typeof a.userId === "string" ? a.userId : a.userId.email;
  }

  async function setOrgWideHolder(level: number, email: string) {
    if (!email) return;
    setHolderError(null);
    const res = await fetch(`${apiPath}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, email, region: "", businessId: null }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setHolderError(data?.message ?? "Could not set that holder.");
      return;
    }
    load();
  }

  async function removeAssignment(id: string) {
    if (!confirm("Remove this assignment?")) return;
    await fetch(`${apiPath}/assignments/${id}`, { method: "DELETE" });
    load();
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!levels) return <p className="subtitle">Loading…</p>;

  const assignableLevels = levels.filter((l) => l.level > 1).sort((a, b) => a.level - b.level);

  return (
    <div>
      <h1>Escalation hierarchy</h1>
      <p className="subtitle">
        What your escalation chain is called, and who actually holds each rung — this is who a case is handed to
        when someone clicks Escalate, shown by name before they click, not just a level number.
      </p>

      <div className="card" style={{ marginBottom: 20, maxWidth: 780 }}>
        <h3>Levels and who holds them</h3>
        <p className="card-sub" style={{ margin: "0 0 12px" }}>
          Level 1 is always the branch\u2019s own owner login. From level 2, give each level a title and choose who holds it. Region- or branch-specific holders are set further down.
        </p>
        {levels
          .slice()
          .sort((a, b) => a.level - b.level)
          .map((l) => {
            const holder = l.level === 1 ? "" : orgWideHolder(l.level);
            const saved = savedLevelNumbers.includes(l.level);
            return (
              <div key={l.level} className="field-row" style={{ alignItems: "flex-end" }}>
                <div className="field" style={{ width: 70 }}>
                  <label>Level</label>
                  <input type="text" value={l.level} disabled />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Title</label>
                  <input
                    type="text"
                    value={l.label}
                    disabled={l.level === 1}
                    onChange={(e) => updateLevelLabel(l.level, e.target.value)}
                    placeholder="e.g. Regional Manager"
                  />
                </div>
                <div className="field" style={{ flex: 1.3 }}>
                  <label>Held by (email)</label>
                  {l.level === 1 ? (
                    <input type="text" value="The branch's own owner login" disabled />
                  ) : saved ? (
                    <select value={holder} onChange={(e) => setOrgWideHolder(l.level, e.target.value)}>
                      <option value="">{holder ? "" : "Choose a person…"}</option>
                      {candidates.map((c) => (
                        <option key={c.email} value={c.email}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value="Save levels first, then choose who holds it" disabled />
                  )}
                </div>
                {l.level !== 1 && (
                  <button className="icon-btn btn-danger" onClick={() => removeLevel(l.level)} title="Remove level">
                    🗑
                  </button>
                )}
              </div>
            );
          })}
        {holderError && <p className="error-text">{holderError}</p>}
        <p className="field-hint" style={{ marginTop: 8 }}>
          The email shown when a case is escalated is the holder chosen here. Holders are people already on your team
          (team members and branch owners). To add someone new, ask your OodelCX account manager to add them as a team member first.
        </p>
        <button className="btn btn-sm" onClick={addLevel} style={{ marginTop: 6 }}>
          + Add level
        </button>

        <div className="field" style={{ marginTop: 16, maxWidth: 260 }}>
          <label>Auto-escalate after (hours)</label>
          <input
            type="number"
            min="1"
            value={slaHours}
            onChange={(e) => setSlaHours(e.target.value)}
            placeholder="Leave blank to disable"
          />
          <p className="field-hint">
            A case sitting unresolved at its current level longer than this automatically bumps to the next level.
          </p>
        </div>

        {levelsError && <p className="error-text">{levelsError}</p>}
        <button className="btn btn-dark btn-sm" disabled={savingLevels} onClick={saveLevels} style={{ marginTop: 10 }}>
          {savingLevels ? "Saving…" : "Save levels"}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 780 }}>
        <h3>Different holders for a region or branch</h3>
        <p className="card-sub" style={{ margin: "0 0 12px" }}>
          {branches.length > 0
            ? "Assign someone org-wide, scoped to one region, or scoped to one specific branch — a branch-specific assignment wins over a region one, which wins over an org-wide one."
            : availableRegions.length > 0
              ? "Assign someone org-wide, or scoped to just one region — a region-specific assignment wins over an org-wide one."
              : "Assign one of your own team to each level above."}
        </p>

        {assignments.length === 0 && <p className="subtitle">No one assigned yet — cases will escalate without notifying anyone.</p>}
        {assignments.length > 0 && (
          <table className="clean" style={{ marginBottom: 14 }}>
            <thead>
              <tr>
                <th>Level</th>
                {(availableRegions.length > 0 || branches.length > 0) && <th>Scope</th>}
                <th>Holder</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a._id}>
                  <td>{levels.find((l) => l.level === a.level)?.label ?? `Level ${a.level}`}</td>
                  {(availableRegions.length > 0 || branches.length > 0) && (
                    <td>
                      {a.businessId
                        ? `Branch — ${branches.find((b) => b.id === a.businessId)?.name ?? "unknown branch"}`
                        : a.region
                          ? `Region — ${a.region}`
                          : "Org-wide"}
                    </td>
                  )}
                  <td>{typeof a.userId === "string" ? a.userId : a.userId.email}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="icon-btn btn-danger" onClick={() => removeAssignment(a._id)}>
                      🗑
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {assignableLevels.length === 0 ? (
          <p className="subtitle">Add a level above 1 first, then assign someone to it.</p>
        ) : (
          <div style={{ padding: 12, background: "var(--bg-2, #f7f7f5)", borderRadius: 8 }}>
            <div className="field-row">
              <div className="field">
                <label>Level</label>
                <select value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
                  <option value="">Select…</option>
                  {assignableLevels.map((l) => (
                    <option key={l.level} value={l.level}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              {(availableRegions.length > 0 || branches.length > 0) && (
                <div className="field">
                  <label>Scope</label>
                  <select
                    value={newScope}
                    onChange={(e) => {
                      const scope = e.target.value as "org" | "region" | "branch";
                      setNewScope(scope);
                      setNewRegion("");
                      setNewBranchId("");
                    }}
                  >
                    <option value="org">Org-wide</option>
                    {availableRegions.length > 0 && <option value="region">A region</option>}
                    {branches.length > 0 && <option value="branch">A specific branch</option>}
                  </select>
                </div>
              )}
              {newScope === "region" && (
                <div className="field">
                  <label>Region</label>
                  <select value={newRegion} onChange={(e) => setNewRegion(e.target.value)}>
                    <option value="">Select…</option>
                    {availableRegions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {newScope === "branch" && (
                <div className="field">
                  <label>Branch</label>
                  <select value={newBranchId} onChange={(e) => setNewBranchId(e.target.value)}>
                    <option value="">Select…</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                        {b.region ? ` (${b.region})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label>Holder</label>
                <select value={newEmail} onChange={(e) => setNewEmail(e.target.value)}>
                  <option value="">Select…</option>
                  {candidates.map((c) => (
                    <option key={c.email} value={c.email}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {assignmentError && <p className="error-text">{assignmentError}</p>}
            <button
              className="btn btn-dark btn-sm"
              disabled={
                savingAssignment ||
                !newLevel ||
                !newEmail ||
                (newScope === "region" && !newRegion) ||
                (newScope === "branch" && !newBranchId)
              }
              onClick={addAssignment}
            >
              {savingAssignment ? "Saving…" : "Assign"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
