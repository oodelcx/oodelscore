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
  const [selectMode, setSelectMode] = useState(false);
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

  const chainView = (b: Branch) => (
    <div>
      <div className="esc-chain">
        {b.chain.length ? b.chain.map((s, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 && <span className="esc-arrow">›</span>}
            <span className="esc-step" title={s.email}>{s.email ? s.email.split("@")[0] : s.label}{s.label && s.email ? ` · ${s.label}` : ""}</span>
          </span>
        )) : <span className="esc-muted">Nobody above this branch yet</span>}
      </div>
      {b.issues.map((x) => (<div key={x} className="esc-warn">{x}</div>))}
    </div>
  );

  const selecting = isGroup && selectMode;

  return (
    <div className="esc">
      {heading && (
        <div className="page-head">
          <h1>Escalation</h1>
          <p className="subtitle">
            {isGroup
              ? "Choose who each branch escalates to first, and who each person escalates to after that. A case follows these choices up to the Group Head."
              : "Choose who a case goes to next, step by step, until it reaches the top."}
          </p>
        </div>
      )}

      <div className="grid grid-4">
        <div className="card"><div className="metric-label">{isGroup ? "BRANCHES" : "LOCATION"}</div><div className="metric-val">{data.branches.length}</div></div>
        <div className="card"><div className="metric-label">ESCALATION PEOPLE</div><div className="metric-val">{data.people.length}</div></div>
        <div className="card"><div className="metric-label">TEAM SEATS USED</div><div className="metric-val">{data.seats.used}{data.seats.limit !== null ? ` / ${data.seats.limit}` : ""}</div></div>
        <div className="card"><div className="metric-label">NEED ATTENTION</div><div className="metric-val" style={{ color: branchesWithIssues ? "#9a6406" : undefined }}>{branchesWithIssues}</div></div>
      </div>

      {error && <div className="callout callout-amber" role="alert">{error}</div>}
      {notice && <div className="callout" role="status">{notice}</div>}

      {/* ---- People ---- */}
      <div className="card">
        <div className="esc-head-row">
          <div>
            <h3>People who handle escalations</h3>
            <p className="card-sub">Each person escalates to one other person. The Group Head is the top.</p>
          </div>
          <div className="esc-actions">
            {seatsFull && !seatOpen && <button className="btn" onClick={() => setSeatOpen(true)}>Request more seats</button>}
            <button className="btn btn-dark" onClick={() => setAddOpen((v) => !v)} disabled={busy}>{addOpen ? "Close" : "Add a person"}</button>
          </div>
        </div>

        {seatsFull && <div className="callout callout-amber" style={{ marginBottom: 12 }}>All {data.seats.limit} team seats are in use. Remove someone who has left, or request more seats from OodelCX.</div>}
        {seatOpen && (
          <div className="esc-form">
            <div>
              <label htmlFor="seat-note">What do you need? (optional)</label>
              <textarea id="seat-note" rows={2} value={seatNote} onChange={(e) => setSeatNote(e.target.value)} placeholder="For example: two more regional managers joining in March" />
            </div>
            <div className="esc-actions">
              <button className="btn btn-dark" disabled={busy} onClick={async () => { if (await act({ action: "requestSeats", note: seatNote })) { setSeatOpen(false); setSeatNote(""); } }}>Send request</button>
              <button className="btn" onClick={() => setSeatOpen(false)}>Cancel</button>
            </div>
          </div>
        )}

        {addOpen && (
          <div className="esc-form">
            <div className="esc-form-grid">
              <div><label htmlFor="add-email">Email</label><input id="add-email" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="name@company.com" /></div>
              <div><label htmlFor="add-title">Title</label><input id="add-title" type="text" value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} placeholder="Regional Manager" /></div>
              <div>
                <label htmlFor="add-tier">Access</label>
                <select id="add-tier" value={addForm.tier} onChange={(e) => setAddForm({ ...addForm, tier: e.target.value })}>
                  <option value="full">Full</option>
                  <option value="limited">Limited (own cases only)</option>
                </select>
              </div>
              <div><label htmlFor="add-up">Escalates to</label><TargetSelect value={addForm.escalatesToId} onChange={(id) => setAddForm({ ...addForm, escalatesToId: id })} targets={peopleTargets} blankLabel="Choose later" /></div>
            </div>
            <div className="esc-actions">
              <button className="btn btn-dark" disabled={busy || seatsFull || !addForm.email || !addForm.title} onClick={submitAdd}>Send invitation</button>
              <span className="esc-muted">They get an email to set a password and use one team seat{seatsLeft !== null ? ` (${seatsLeft} left)` : ""}.</span>
            </div>
          </div>
        )}

        <div className="esc-list">
          <div className="esc-row esc-people esc-th"><span>Person</span><span>Escalates to</span><span>Handles</span><span /></div>
          {data.people.map((p) => (
            <div className="esc-row esc-people" key={p.id}>
              <div className="esc-main">
                <strong>{p.email}</strong>
                <span>
                  {p.title || "—"}
                  {p.inviteStatus !== "active" && <> · <span className="pill pill-amber" style={{ display: "inline" }}>{p.inviteStatus === "invite_pending" ? "Invited" : "Invite expired"}</span></>}
                  {p.tier === "limited" && <> · <span className="pill pill-gray" style={{ display: "inline" }}>Limited</span></>}
                </span>
              </div>
              <div>
                {p.kind === "head" ? (
                  <span className="esc-muted">Top of the chain</span>
                ) : (
                  <TargetSelect value={p.escalatesToId ?? ""} onChange={(id) => act({ action: "setPerson", personId: p.id, toEmail: emailOf(id) })} targets={peopleTargets} exclude={p.id} blankLabel="No one (top of their chain)" disabled={busy} />
                )}
              </div>
              <div className="esc-count">{p.usedByBranches} branch{p.usedByBranches === 1 ? "" : "es"}<br />{p.openCases} open case{p.openCases === 1 ? "" : "s"}</div>
              <div>{p.kind === "team" && <button className="btn" disabled={busy} onClick={() => { setLeaver(p); setLeaverMode("existing"); setLeaverExisting(""); setError(null); }}>Remove or replace</button>}</div>
            </div>
          ))}
          {!data.people.length && <p className="esc-muted" style={{ padding: "14px 0" }}>No one yet. Add the people who handle escalations, or ask OodelCX to import them.</p>}
        </div>

        {leaver && (
          <div className="esc-form" style={{ marginTop: 14, marginBottom: 0 }}>
            <div>
              <strong>{leaver.email} is leaving</strong>
              <p className="card-sub" style={{ margin: "4px 0 0" }}>
                Everyone who escalated to them{leaver.usedByBranches ? ` (${leaver.usedByBranches} branch${leaver.usedByBranches === 1 ? "" : "es"})` : ""}{leaver.openCases ? ` and their ${leaver.openCases} open case${leaver.openCases === 1 ? "" : "s"}` : ""} move to whoever takes over. Each case records the handover.
              </p>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", margin: 0 }}><input type="radio" checked={leaverMode === "existing"} onChange={() => setLeaverMode("existing")} /> Someone already on the team takes over</label>
            {leaverMode === "existing" && <TargetSelect value={leaverExisting} onChange={setLeaverExisting} targets={peopleTargets} exclude={leaver.id} blankLabel="Choose a person…" />}
            <label style={{ display: "flex", gap: 8, alignItems: "center", margin: 0 }}><input type="radio" checked={leaverMode === "new"} onChange={() => setLeaverMode("new")} /> Invite a replacement <span className="esc-muted">(takes the leaver&apos;s seat, so it works even when seats are full)</span></label>
            {leaverMode === "new" && (
              <div className="esc-form-grid">
                <div><label htmlFor="rep-email">Replacement&apos;s email</label><input id="rep-email" type="email" value={leaverNew.email} onChange={(e) => setLeaverNew({ ...leaverNew, email: e.target.value })} /></div>
                <div><label htmlFor="rep-title">Title</label><input id="rep-title" type="text" value={leaverNew.title} onChange={(e) => setLeaverNew({ ...leaverNew, title: e.target.value })} placeholder={leaver.title} /></div>
              </div>
            )}
            <label style={{ display: "flex", gap: 8, alignItems: "center", margin: 0 }}><input type="radio" checked={leaverMode === "none"} onChange={() => setLeaverMode("none")} /> No replacement yet: move everything to whoever they escalated to{data.head ? " (or the Group Head)" : ""}</label>
            <div className="esc-actions">
              <button className="btn btn-dark" disabled={busy || (leaverMode === "new" && !leaverNew.email)} onClick={submitLeaver}>Confirm</button>
              <button className="btn" onClick={() => setLeaver(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Branches ---- */}
      <div className="card">
        <div className="esc-head-row">
          <div>
            <h3>{isGroup ? "Branches" : "This location"}</h3>
            <p className="card-sub">Who each {isGroup ? "branch" : "location"} escalates to first. After that, the chain follows the people above.</p>
          </div>
          <div className="esc-actions">
            {isGroup && data.branches.length > 1 && (
              <button className="btn" onClick={() => { setSelectMode((v) => !v); setPicked(new Set()); }}>{selectMode ? "Done" : "Set several at once"}</button>
            )}
            {isGroup && <input className="esc-search" type="search" aria-label="Search branches" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search branch, region or manager" />}
          </div>
        </div>

        {selecting && (
          <div className="esc-bulk">
            <span><strong>{picked.size}</strong> selected. Tick branches below, choose who they escalate to, then apply.</span>
            <TargetSelect value={bulkTo} onChange={setBulkTo} targets={peopleTargets} blankLabel="Group Head (default)" />
            <button className="btn btn-dark" disabled={busy || picked.size === 0} onClick={() => saveBranches([...picked], bulkTo)}>Apply to {picked.size || "…"}</button>
            <button className="btn" onClick={toggleAllShown}>{shown.every((b) => picked.has(b.id)) ? "Unselect page" : "Select this page"}</button>
          </div>
        )}

        <div className="esc-list">
          <div className={`esc-row esc-th${selecting ? " selecting" : ""}`}>
            {selecting && <span />}
            <span>{isGroup ? "Branch" : "Location"}</span><span>Escalates to first</span><span>Then</span>
          </div>
          {shown.map((b) => (
            <div className={`esc-row${selecting ? " selecting" : ""}`} key={b.id}>
              {selecting && <input type="checkbox" aria-label={`Select ${b.name}`} checked={picked.has(b.id)} onChange={() => togglePick(b.id)} />}
              <div className="esc-main">
                <strong>{b.name}</strong>
                <span>{[b.region, b.managerEmail && `${data.branchTitle}: ${b.managerEmail}`].filter(Boolean).join(" · ") || "—"}</span>
              </div>
              <div><TargetSelect value={b.escalatesToId ?? ""} onChange={(id) => saveBranches([b.id], id)} targets={peopleTargets} blankLabel={data.head ? "Group Head (default)" : "Choose a person…"} disabled={busy} /></div>
              {chainView(b)}
            </div>
          ))}
          {!shown.length && <p className="esc-muted" style={{ padding: "14px 0" }}>No branches match.</p>}
        </div>

        {pageCount > 1 && (
          <div className="esc-pager">
            <button className="btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button>
            <span>Page {safePage + 1} of {pageCount} · {filtered.length} branches</span>
            <button className="btn" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</button>
          </div>
        )}
      </div>

      {/* ---- Timing ---- */}
      <div className="card">
        <h3>Time at each step</h3>
        <p className="card-sub" style={{ margin: "3px 0 12px" }}>If a case sits untouched this long, it moves up to the next person on its own. Leave blank to escalate by hand only.</p>
        <div className="esc-time">
          <input aria-label="Hours at each step" type="number" min={1} value={slaDraft} onChange={(e) => setSlaDraft(e.target.value)} placeholder="Hours" />
          <span className="esc-muted">hours</span>
          <button className="btn btn-dark" disabled={busy} onClick={() => act({ action: "setSla", hours: slaDraft.trim() ? Number(slaDraft) : null })}>Save</button>
        </div>
      </div>

      {/* ---- Admin bulk import ---- */}
      {isAdmin && (
        <div className="card">
          <h3>Import from a file</h3>
          <p className="card-sub" style={{ margin: "3px 0 12px" }}>For first-time setup. Import the people first, then the branches. Every row is checked before anything is saved; one problem blocks the whole file.</p>
          <div className="esc-form">
            <div className="esc-actions">
              <select aria-label="What the file contains" value={importKind} onChange={(e) => { setImportKind(e.target.value as "people" | "branches"); setImportRows([]); setImportText(""); setImportPreview(null); }} style={{ maxWidth: 360 }}>
                <option value="people">People (email, title, access, escalates_to_email)</option>
                <option value="branches">Branches (branch, escalates_to_email)</option>
              </select>
              <button className="btn" onClick={() => download(`escalation-${importKind}-template.csv`, TEMPLATES[importKind])}>Download template</button>
              <input aria-label="Choose a CSV file" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            <div>
              <label htmlFor="import-text">Or paste the rows (with the header line)</label>
              <textarea id="import-text" rows={4} value={importText} onChange={(e) => { setImportText(e.target.value); setImportRows(parseCsv(e.target.value)); setImportPreview(null); }} />
            </div>
            <div className="esc-actions">
              <button className="btn btn-dark" disabled={busy || !importRows.length} onClick={() => act({ action: "importPreview", kind: importKind, rows: importRows })}>Check {importRows.length || ""} row{importRows.length === 1 ? "" : "s"}</button>
              {importPreview && !importPreview.hasErrors && (
                <button className="btn btn-dark" disabled={busy} onClick={async () => { if (await act({ action: "importApply", kind: importKind, rows: importRows })) { setImportPreview(null); setImportRows([]); setImportText(""); } }}>Apply import</button>
              )}
            </div>
          </div>
          {importPreview && (
            <div className="esc-list">
              {importPreview.preview.map((r, i) => (
                <div className="esc-row" key={`${r.row}-${i}`} style={{ gridTemplateColumns: "60px minmax(160px, 1fr) minmax(0, 3fr)" }}>
                  <span className="esc-muted">Row {r.row || "—"}</span>
                  <strong>{r.label}</strong>
                  <span style={{ color: r.status === "error" ? "#a8261d" : undefined }}>
                    <span className={`pill ${r.status === "error" ? "pill-red" : r.status === "new" ? "pill-green" : "pill-gray"}`} style={{ marginRight: 8 }}>{r.status === "error" ? "Problem" : r.status === "new" ? "New" : r.status === "update" ? "Update" : "Same"}</span>{r.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Change log ---- */}
      <div className="card">
        <h3>Recent changes</h3>
        <p className="card-sub" style={{ margin: "3px 0 8px" }}>Changes made here or by OodelCX both appear below.</p>
        {data.changeLog.length ? (
          <ul className="esc-log">
            {data.changeLog.map((l) => (
              <li key={l.id}><span>{l.summary}</span><span>{new Date(l.at).toLocaleString()} · {l.byKind === "admin" ? "OodelCX" : l.by}</span></li>
            ))}
          </ul>
        ) : (
          <p className="esc-muted">No changes yet.</p>
        )}
      </div>
    </div>
  );
}
