"use client";

import { useEffect, useMemo, useState } from "react";

interface Person {
  id: string;
  email: string;
  title: string;
  kind: "head" | "team";
  tier: "full" | "limited" | null;
  escalatesToId: string | null;
  inviteStatus: string;
  usedByBranches: number;
  openCases: number;
}
interface Branch {
  id: string;
  name: string;
  region: string;
  managerEmail: string;
  escalatesToId: string | null;
  chain: { label: string; email: string }[];
  issues: string[];
}
interface Target { id: string; email: string; label: string }
interface Data {
  kind: "parentOrg" | "business";
  name: string;
  enabled: boolean;
  model: "pointers" | "legacy";
  branchTitle: string;
  slaHours: number | null;
  head: { id: string; email: string } | null;
  branches: Branch[];
  people: Person[];
  targets: Target[];
  seats: { used: number; limit: number | null };
  legacy: { levels: { level: number; label: string }[]; assignmentCount: number };
  changeLog: { id: string; at: string; by: string; byKind: string; summary: string }[];
}
interface ImportPreviewRow { row: number; label: string; status: "new" | "update" | "unchanged" | "error"; message: string }

const PAGE = 25;

/** Minimal CSV reader: commas, quoted cells, doubled quotes. Header names are lower-cased with spaces as underscores. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { cur.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      cur.push(cell); cell = "";
      if (cur.some((x) => x.trim())) rows.push(cur);
      cur = [];
    } else cell += c;
  }
  cur.push(cell);
  if (cur.some((x) => x.trim())) rows.push(cur);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const TEMPLATES = {
  people: "email,title,access,escalates_to_email\nregional.north@yourcompany.com,Regional Manager,full,ops.head@yourcompany.com\n",
  branches: "branch,escalates_to_email\nLahore - Gulberg,cluster.lahore@yourcompany.com\n",
};

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function TargetSelect({ value, onChange, targets, exclude, blankLabel, disabled }: { value: string; onChange: (id: string) => void; targets: Target[]; exclude?: string; blankLabel: string; disabled?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label="Escalates to">
      <option value="">{blankLabel}</option>
      {targets.filter((t) => t.id !== exclude).map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
    </select>
  );
}

/**
 * One screen for "who handles escalations", shared by a group, a standalone
 * business and OodelCX Admin (the same records, so a change on either side
 * shows on the other). Every branch and every person has one "escalates to"
 * choice; the chain a case follows is read off those choices. OodelCX sets it
 * up with the customer (by hand or from a file); the customer then keeps it
 * current when people move or leave.
 */
export function StructureClient({ apiPath, heading = true }: { apiPath: string; heading?: boolean }) {
  const isAdmin = apiPath.startsWith("/api/admin/");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkTo, setBulkTo] = useState("");
  const [slaDraft, setSlaDraft] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", title: "", tier: "full", escalatesToId: "" });
  const [leaver, setLeaver] = useState<Person | null>(null);
  const [leaverMode, setLeaverMode] = useState<"existing" | "new" | "none">("existing");
  const [leaverExisting, setLeaverExisting] = useState("");
  const [leaverNew, setLeaverNew] = useState({ email: "", title: "", tier: "full" });
  const [seatNote, setSeatNote] = useState("");
  const [seatOpen, setSeatOpen] = useState(false);

  const [importKind, setImportKind] = useState<"people" | "branches">("people");
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<{ preview: ImportPreviewRow[]; hasErrors: boolean } | null>(null);

  async function load() {
    const res = await fetch(apiPath);
    const d = await res.json().catch(() => null);
    if (!res.ok) { setError(d?.message ?? "Could not load."); return; }
    setData(d);
    setSlaDraft(d.slaHours ? String(d.slaHours) : "");
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [apiPath]);

  async function act(body: Record<string, unknown>, okMessage?: string): Promise<boolean> {
    setBusy(true); setError(null); setNotice(null);
    const res = await fetch(apiPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setError(d?.message ?? "That could not be saved."); return false; }
    if (d.import) { setImportPreview(d.import); return true; }
    setData(d);
    setSlaDraft(d.slaHours ? String(d.slaHours) : "");
    setNotice(d.message ?? okMessage ?? null);
    return true;
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.branches.filter((b) => !q || b.name.toLowerCase().includes(q) || b.region.toLowerCase().includes(q) || b.managerEmail.toLowerCase().includes(q));
  }, [data, search]);

  if (error && !data) return <p className="error-text">{error}</p>;
  if (!data) return <p className="subtitle">Loading…</p>;

  const isGroup = data.kind === "parentOrg";
  const byId = new Map(data.targets.map((t) => [t.id, t]));
  const emailOf = (id: string | null) => (id ? byId.get(id)?.email ?? "" : "");
  const seatsFull = data.seats.limit !== null && data.seats.used >= data.seats.limit;
  const seatsLeft = data.seats.limit === null ? null : Math.max(0, data.seats.limit - data.seats.used);
  const branchesWithIssues = data.branches.filter((b) => b.issues.length).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);
  const peopleTargets = data.targets.filter((t) => data.people.some((p) => p.id === t.id));

  // ---- Not on the "escalates to" screen yet ----
  if (data.model !== "pointers") {
    const hasLegacy = data.legacy.levels.length > 1 || data.legacy.assignmentCount > 0;
    return (
      <div style={{ maxWidth: 760 }}>
        {heading && <h1>Escalation</h1>}
        <div className="card">
          <h3>{hasLegacy ? "This account still uses the older escalation setup" : "Set up who handles escalations"}</h3>
          <p className="subtitle" style={{ marginTop: 6 }}>
            {hasLegacy
              ? `Today: ${data.legacy.levels.filter((l) => l.level > 1).map((l) => l.label).join(" → ") || "no levels"}, with ${data.legacy.assignmentCount} named holder${data.legacy.assignmentCount === 1 ? "" : "s"}. Cases keep escalating this way until you switch. Switching keeps the same people and the same order for every branch; branch-specific holders are kept where they differ.`
              : "Choose, for every branch and every person, who a case goes to next. Cases then follow those choices up to the top."}
          </p>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-dark" disabled={busy} onClick={() => act({ action: "convertLegacy" })}>{hasLegacy ? "Switch to the new screen" : "Start"}</button>
        </div>
      </div>
    );
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAllShown() {
    setPicked((prev) => {
      const next = new Set(prev);
      const all = shown.every((b) => next.has(b.id));
      for (const b of shown) { if (all) next.delete(b.id); else next.add(b.id); }
      return next;
    });
  }

  async function saveBranches(ids: string[], toId: string) {
    const ok = await act({ action: "setBranches", businessIds: ids, toEmail: emailOf(toId) });
    if (ok) { setPicked(new Set()); setBulkTo(""); }
  }

  async function submitAdd() {
    const ok = await act({ action: "addPerson", email: addForm.email, title: addForm.title, tier: addForm.tier, escalatesToEmail: emailOf(addForm.escalatesToId) });
    if (ok) { setAddForm({ email: "", title: "", tier: "full", escalatesToId: "" }); setAddOpen(false); }
  }

  async function submitLeaver() {
    if (!leaver) return;
    const body: Record<string, unknown> = { action: "removePerson", personId: leaver.id };
    if (leaverMode === "existing") {
      if (!leaverExisting) { setError("Choose who takes over."); return; }
      body.replacementId = leaverExisting;
    } else if (leaverMode === "new") {
      body.newPerson = { email: leaverNew.email, title: leaverNew.title || leaver.title, tier: leaverNew.tier };
    }
    const ok = await act(body);
    if (ok) { setLeaver(null); setLeaverNew({ email: "", title: "", tier: "full" }); setLeaverExisting(""); }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    file.text().then((t) => { setImportText(t); setImportRows(parseCsv(t)); setImportPreview(null); });
  }

  return (
    <div style={{ maxWidth: 1040 }}>
      {heading && (
        <>
          <h1>Escalation</h1>
          <p className="subtitle">
            {isGroup
              ? "For every branch, and for every person, choose who a case goes to next. A case follows those choices up to the Group Head."
              : "Choose who a case goes to next, step by step, until it reaches the top."}
          </p>
        </>
      )}

      <div className="card" style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
        <div><div className="field-hint">{isGroup ? "Branches" : "Location"}</div><strong style={{ fontSize: 22 }}>{data.branches.length}</strong></div>
        <div><div className="field-hint">Escalation people</div><strong style={{ fontSize: 22 }}>{data.people.length}</strong></div>
        <div>
          <div className="field-hint">Team seats</div>
          <strong style={{ fontSize: 22 }}>{data.seats.used}{data.seats.limit !== null ? ` of ${data.seats.limit}` : ""}</strong>
        </div>
        <div>
          <div className="field-hint">Needs attention</div>
          <strong style={{ fontSize: 22, color: branchesWithIssues ? "#b45309" : "inherit" }}>{branchesWithIssues}</strong>
        </div>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}
      {notice && <p className="callout" role="status">{notice}</p>}

      {/* ---- People ---- */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>People who handle escalations</h3>
            <p className="card-sub" style={{ margin: "4px 0 0" }}>Each person escalates to one other person. The Group Head is the top and escalates to no one.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {seatsFull && !seatOpen && <button className="btn" onClick={() => setSeatOpen(true)}>Request more seats</button>}
            <button className="btn btn-dark" onClick={() => setAddOpen((v) => !v)} disabled={busy}>{addOpen ? "Close" : "Add a person"}</button>
          </div>
        </div>

        {seatsFull && (
          <p className="callout" style={{ marginTop: 12 }}>
            All {data.seats.limit} team seats are in use. To add someone, remove a person who has left, or request more seats from OodelCX.
          </p>
        )}
        {seatOpen && (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="seat-note">What do you need? (optional)</label>
            <textarea id="seat-note" rows={2} value={seatNote} onChange={(e) => setSeatNote(e.target.value)} placeholder="For example: two more regional managers joining in March" />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-dark" disabled={busy} onClick={async () => { if (await act({ action: "requestSeats", note: seatNote })) { setSeatOpen(false); setSeatNote(""); } }}>Send request</button>
              <button className="btn" onClick={() => setSeatOpen(false)}>Cancel</button>
            </div>
          </div>
        )}

        {addOpen && (
          <div style={{ marginTop: 14, padding: 14, border: "1px solid var(--border, #e5e7eb)", borderRadius: 10 }}>
            <div className="field-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 220px" }}>
                <label htmlFor="add-email">Email</label>
                <input id="add-email" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="name@company.com" />
              </div>
              <div className="field" style={{ flex: "1 1 180px" }}>
                <label htmlFor="add-title">Title</label>
                <input id="add-title" value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} placeholder="Regional Manager" />
              </div>
              <div className="field" style={{ flex: "0 1 150px" }}>
                <label htmlFor="add-tier">Access</label>
                <select id="add-tier" value={addForm.tier} onChange={(e) => setAddForm({ ...addForm, tier: e.target.value })}>
                  <option value="full">Full</option>
                  <option value="limited">Limited (own cases only)</option>
                </select>
              </div>
              <div className="field" style={{ flex: "1 1 220px" }}>
                <label htmlFor="add-up">Escalates to</label>
                <TargetSelect value={addForm.escalatesToId} onChange={(id) => setAddForm({ ...addForm, escalatesToId: id })} targets={peopleTargets} blankLabel="Choose later" />
              </div>
            </div>
            <p className="field-hint">They get an email to set their password. This uses one team seat{seatsLeft !== null ? ` (${seatsLeft} left)` : ""}.</p>
            <button className="btn btn-dark" disabled={busy || seatsFull || !addForm.email || !addForm.title} onClick={submitAdd}>Send invitation</button>
          </div>
        )}

        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Person</th><th>Title</th><th>Escalates to</th><th>Branches</th><th>Open cases</th><th /></tr>
            </thead>
            <tbody>
              {data.people.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.email}
                    {p.inviteStatus !== "active" && <span className="pill" style={{ marginLeft: 6 }}>{p.inviteStatus === "invite_pending" ? "Invited" : "Invite expired"}</span>}
                    {p.tier === "limited" && <span className="pill" style={{ marginLeft: 6 }}>Limited</span>}
                  </td>
                  <td>{p.title || "—"}</td>
                  <td style={{ minWidth: 230 }}>
                    {p.kind === "head" ? (
                      <span className="field-hint">Top of the chain</span>
                    ) : (
                      <TargetSelect
                        value={p.escalatesToId ?? ""}
                        onChange={(id) => act({ action: "setPerson", personId: p.id, toEmail: emailOf(id) })}
                        targets={peopleTargets}
                        exclude={p.id}
                        blankLabel="No one (top of their chain)"
                        disabled={busy}
                      />
                    )}
                  </td>
                  <td>{p.usedByBranches}</td>
                  <td>{p.openCases}</td>
                  <td style={{ textAlign: "right" }}>
                    {p.kind === "team" && (
                      <button className="btn" disabled={busy} onClick={() => { setLeaver(p); setLeaverMode("existing"); setLeaverExisting(""); setError(null); }}>Remove or replace</button>
                    )}
                  </td>
                </tr>
              ))}
              {!data.people.length && <tr><td colSpan={6} className="field-hint">No one yet. Add the people who handle escalations, or ask OodelCX to import them.</td></tr>}
            </tbody>
          </table>
        </div>

        {leaver && (
          <div style={{ marginTop: 14, padding: 14, border: "1px solid var(--border, #e5e7eb)", borderRadius: 10 }}>
            <h4 style={{ margin: 0 }}>{leaver.email} is leaving</h4>
            <p className="card-sub" style={{ margin: "4px 0 10px" }}>
              Everyone who escalated to them{leaver.usedByBranches ? ` (${leaver.usedByBranches} branch${leaver.usedByBranches === 1 ? "" : "es"})` : ""}{leaver.openCases ? ` and their ${leaver.openCases} open case${leaver.openCases === 1 ? "" : "s"}` : ""} move to whoever takes over. Each case shows the handover in its timeline.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <label><input type="radio" checked={leaverMode === "existing"} onChange={() => setLeaverMode("existing")} /> Someone already on the team takes over</label>
              {leaverMode === "existing" && (
                <TargetSelect value={leaverExisting} onChange={setLeaverExisting} targets={peopleTargets} exclude={leaver.id} blankLabel="Choose a person…" />
              )}
              <label>
                <input type="radio" checked={leaverMode === "new"} onChange={() => setLeaverMode("new")} disabled={false} /> Invite a replacement{" "}
                <span className="field-hint">(takes the leaver&apos;s seat, so this works even when seats are full)</span>
              </label>
              {leaverMode === "new" && (
                <div className="field-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div className="field" style={{ flex: "1 1 220px" }}>
                    <label htmlFor="rep-email">Replacement&apos;s email</label>
                    <input id="rep-email" type="email" value={leaverNew.email} onChange={(e) => setLeaverNew({ ...leaverNew, email: e.target.value })} />
                  </div>
                  <div className="field" style={{ flex: "1 1 180px" }}>
                    <label htmlFor="rep-title">Title</label>
                    <input id="rep-title" value={leaverNew.title} onChange={(e) => setLeaverNew({ ...leaverNew, title: e.target.value })} placeholder={leaver.title} />
                  </div>
                </div>
              )}
              <label><input type="radio" checked={leaverMode === "none"} onChange={() => setLeaverMode("none")} /> No replacement yet: move everything to whoever they escalated to{data.head ? " (or the Group Head)" : ""}</label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn btn-dark" disabled={busy || (leaverMode === "new" && !leaverNew.email)} onClick={submitLeaver}>Confirm</button>
              <button className="btn" onClick={() => setLeaver(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Branches ---- */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>{isGroup ? "Branches" : "This location"}</h3>
        <p className="card-sub" style={{ margin: "4px 0 12px" }}>
          Choose who each {isGroup ? "branch" : "location"} escalates to first. {isGroup ? "Tick several branches to set them in one go. " : ""}After that, the chain follows the people above.
        </p>

        {isGroup && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <input aria-label="Search branches" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search branch, region or manager" style={{ flex: "1 1 240px" }} />
            {picked.size > 0 && (
              <>
                <span className="field-hint">{picked.size} selected</span>
                <TargetSelect value={bulkTo} onChange={setBulkTo} targets={peopleTargets} blankLabel="Group Head (default)" />
                <button className="btn btn-dark" disabled={busy} onClick={() => saveBranches([...picked], bulkTo)}>Set for {picked.size}</button>
                <button className="btn" onClick={() => setPicked(new Set())}>Clear</button>
              </>
            )}
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                {isGroup && <th style={{ width: 28 }}><input type="checkbox" aria-label="Select all on this page" checked={shown.length > 0 && shown.every((b) => picked.has(b.id))} onChange={toggleAllShown} /></th>}
                <th>{isGroup ? "Branch" : "Location"}</th>
                <th>{data.branchTitle}</th>
                <th>Escalates to</th>
                <th>Then</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.id}>
                  {isGroup && <td><input type="checkbox" aria-label={`Select ${b.name}`} checked={picked.has(b.id)} onChange={() => togglePick(b.id)} /></td>}
                  <td>
                    <strong>{b.name}</strong>
                    {b.region && <div className="field-hint">{b.region}</div>}
                  </td>
                  <td>{b.managerEmail || "—"}</td>
                  <td style={{ minWidth: 230 }}>
                    <TargetSelect value={b.escalatesToId ?? ""} onChange={(id) => saveBranches([b.id], id)} targets={peopleTargets} blankLabel={data.head ? "Group Head (default)" : "Choose a person…"} disabled={busy} />
                  </td>
                  <td>
                    <div className="field-hint">
                      {b.chain.length ? b.chain.map((s) => `${s.label}${s.email ? ` (${s.email})` : ""}`).join(" → ") : "Nobody above this branch yet"}
                    </div>
                    {b.issues.map((i) => (<div key={i} className="error-text" style={{ fontSize: 12 }}>{i}</div>))}
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={5} className="field-hint">No branches match.</td></tr>}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
            <button className="btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button>
            <span className="field-hint">Page {safePage + 1} of {pageCount} · {filtered.length} branches</span>
            <button className="btn" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</button>
          </div>
        )}
      </div>

      {/* ---- Timing ---- */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>Time at each step</h3>
        <p className="card-sub" style={{ margin: "4px 0 12px" }}>If a case sits untouched this long, it moves up to the next person on its own. Leave blank to escalate by hand only.</p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input aria-label="Hours at each step" type="number" min={1} value={slaDraft} onChange={(e) => setSlaDraft(e.target.value)} style={{ width: 110 }} placeholder="Hours" />
          <span className="field-hint">hours</span>
          <button className="btn btn-dark" disabled={busy} onClick={() => act({ action: "setSla", hours: slaDraft.trim() ? Number(slaDraft) : null })}>Save</button>
        </div>
      </div>

      {/* ---- Admin bulk import ---- */}
      {isAdmin && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0 }}>Import from a file</h3>
          <p className="card-sub" style={{ margin: "4px 0 12px" }}>
            For first-time setup. Import the people first, then the branches. You see every row checked before anything is saved; one problem blocks the whole file.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select aria-label="What the file contains" value={importKind} onChange={(e) => { setImportKind(e.target.value as "people" | "branches"); setImportRows([]); setImportText(""); setImportPreview(null); }}>
              <option value="people">People (email, title, access, escalates_to_email)</option>
              <option value="branches">Branches (branch, escalates_to_email)</option>
            </select>
            <button className="btn" onClick={() => download(`escalation-${importKind}-template.csv`, TEMPLATES[importKind])}>Download template</button>
            <input aria-label="Choose a CSV file" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="import-text">Or paste the rows (with the header line)</label>
            <textarea id="import-text" rows={4} value={importText} onChange={(e) => { setImportText(e.target.value); setImportRows(parseCsv(e.target.value)); setImportPreview(null); }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-dark" disabled={busy || !importRows.length} onClick={() => act({ action: "importPreview", kind: importKind, rows: importRows })}>Check {importRows.length || ""} row{importRows.length === 1 ? "" : "s"}</button>
            {importPreview && !importPreview.hasErrors && (
              <button className="btn btn-dark" disabled={busy} onClick={async () => { if (await act({ action: "importApply", kind: importKind, rows: importRows })) { setImportPreview(null); setImportRows([]); setImportText(""); } }}>Apply import</button>
            )}
          </div>
          {importPreview && (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table className="table" style={{ width: "100%" }}>
                <thead><tr><th>Row</th><th>Who</th><th>Result</th></tr></thead>
                <tbody>
                  {importPreview.preview.map((r, i) => (
                    <tr key={`${r.row}-${i}`}>
                      <td>{r.row || "—"}</td>
                      <td>{r.label}</td>
                      <td style={{ color: r.status === "error" ? "#b91c1c" : undefined }}>{r.status === "error" ? "Problem: " : r.status === "new" ? "New: " : r.status === "update" ? "Update: " : "Same: "}{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---- Change log ---- */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>Recent changes</h3>
        <p className="card-sub" style={{ margin: "4px 0 10px" }}>Changes made here or by OodelCX both appear below.</p>
        {data.changeLog.length ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {data.changeLog.map((l) => (
              <li key={l.id}>
                <span>{l.summary}</span>{" "}
                <span className="field-hint">{new Date(l.at).toLocaleString()} · {l.byKind === "admin" ? "OodelCX" : l.by}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-hint">No changes yet.</p>
        )}
      </div>
    </div>
  );
}
