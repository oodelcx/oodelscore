"use client";

import { useEffect, useState } from "react";

interface Tier { key: string; name: string }
interface Step { title: string; email: string }
interface Node { id: string; tierKey: string; name: string; parentNodeId: string | null; managerEmail: string; managerTitle: string; branchCount: number }
interface Branch { id: string; name: string; region: string; orgNodeId: string | null }
interface Candidate { email: string; label: string }
interface Data {
  kind: "parentOrg" | "business";
  name: string;
  enabled: boolean;
  tiers: Tier[];
  branchTitle: string;
  groupSteps: Step[];
  slaHours: number | null;
  slaByTier: Record<string, number>;
  nodes: Node[];
  branches: Branch[];
  candidates: Candidate[];
  legacy: { levels: { level: number; label: string }[]; assignmentCount: number; hasScoped: boolean };
}
interface Preview { steps: { level: number; label: string; email: string; hours: number | null }[]; slaHours: number | null }

/**
 * One screen for "who handles escalations", shared by a group, a standalone
 * business and Admin. Top to bottom: the group and its team, then the levels
 * the group uses (Region, Cluster...), then the boxes under each level, then
 * the branches. The escalation chain is read straight off this tree, so there
 * is no separate list of numbered levels to keep in step.
 */
export function StructureClient({ apiPath, heading = true }: { apiPath: string; heading?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewBranch, setPreviewBranch] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  async function load() {
    const res = await fetch(apiPath);
    const d = await res.json().catch(() => null);
    if (!res.ok) { setError(d?.message ?? "Could not load."); return; }
    setData(d);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [apiPath]);

  async function act(body: Record<string, unknown>, okMessage?: string) {
    setBusy(true); setError(null); setNotice(null);
    const res = await fetch(apiPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setError(d?.message ?? "That could not be saved."); return false; }
    if (d.preview) { setPreview(d.preview); return true; }
    setData(d);
    if (okMessage) setNotice(okMessage);
    return true;
  }

  useEffect(() => {
    if (!previewBranch || !data?.enabled) { setPreview(null); return; }
    act({ action: "preview", businessId: previewBranch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewBranch, data?.enabled, data?.nodes, data?.groupSteps, data?.branches]);

  if (error && !data) return <p className="error-text">{error}</p>;
  if (!data) return <p className="subtitle">Loading…</p>;

  const isGroup = data.kind === "parentOrg";
  const people = data.candidates;

  const PersonSelect = ({ value, onChange }: { value: string; onChange: (email: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Person">
      <option value="">{value ? "" : "Choose a person…"}</option>
      {people.map((c) => (<option key={c.email} value={c.email}>{c.label}</option>))}
    </select>
  );

  // ---- Not on the new structure yet ----
  if (!data.enabled) {
    const hasLegacy = data.legacy.levels.length > 1 || data.legacy.assignmentCount > 0;
    return (
      <div style={{ maxWidth: 760 }}>
        {heading && <h1>Escalation and structure</h1>}
        <div className="card">
          <h3>{hasLegacy ? "This account still uses the older escalation setup" : "Set up who handles escalations"}</h3>
          <p className="subtitle" style={{ marginTop: 6 }}>
            {isGroup
              ? "The new screen works top to bottom: your group and its team, then the levels you use (Region, Cluster and so on), then your branches. The escalation chain is worked out from that, so there is nothing else to keep in step."
              : "Choose who a case goes to when it is escalated, in order."}
          </p>
          {hasLegacy && (
            <p className="subtitle">
              Today: {data.legacy.levels.filter((l) => l.level > 1).map((l) => l.label).join(" → ") || "no levels"}, with {data.legacy.assignmentCount} named holder{data.legacy.assignmentCount === 1 ? "" : "s"}.
              Cases keep escalating this way until you switch. Switching copies your current people across{data.legacy.hasScoped ? "; region holders become Region boxes, and any branch-specific holders must be set again" : ""}.
            </p>
          )}
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-dark" disabled={busy} onClick={() => act(hasLegacy ? { action: "convertLegacy" } : { action: "saveSettings" })}>
            {hasLegacy ? "Switch to the new structure" : "Start"}
          </button>
        </div>
      </div>
    );
  }

  const topNodes = (tierKey: string) => data.nodes.filter((n) => n.tierKey === tierKey);
  const tierIndex = (key: string) => data.tiers.findIndex((t) => t.key === key);
  const lowestTier = data.tiers[data.tiers.length - 1];
  const nodeBranches = (id: string) => data.branches.filter((b) => b.orgNodeId === id);
  const unassigned = data.branches.filter((b) => !b.orgNodeId);

  function saveSteps(steps: Step[]) { return act({ action: "saveSettings", groupSteps: steps }); }
  function saveTiers(tiers: Tier[]) { return act({ action: "saveSettings", tiers }); }

  function NodeBox({ node, depth }: { node: Node; depth: number }) {
    const idx = tierIndex(node.tierKey);
    const childTier = data!.tiers[idx + 1];
    const kids = data!.nodes.filter((n) => n.parentNodeId === node.id);
    const [names, setNames] = useState("");
    const [open, setOpen] = useState(false);
    const tierName = data!.tiers[idx]?.name ?? node.tierKey;
    return (
      <div style={{ marginLeft: depth ? 18 : 0, borderLeft: depth ? "2px solid var(--border)" : "none", paddingLeft: depth ? 12 : 0, marginTop: 10 }}>
        <div className="card" style={{ padding: 12 }}>
          <div className="field-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ flex: 1.2, minWidth: 150 }}>
              <label>{tierName}</label>
              <input type="text" defaultValue={node.name} onBlur={(e) => e.target.value.trim() && e.target.value !== node.name && act({ action: "updateNode", id: node.id, name: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label>Their title</label>
              <input type="text" defaultValue={node.managerTitle} placeholder={`${tierName} manager`} onBlur={(e) => e.target.value !== node.managerTitle && act({ action: "updateNode", id: node.id, managerTitle: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1.4, minWidth: 190 }}>
              <label>Who handles escalations (email)</label>
              <PersonSelect value={node.managerEmail} onChange={(email) => act({ action: "updateNode", id: node.id, managerEmail: email })} />
            </div>
            <button className="icon-btn btn-danger" title="Delete this box" onClick={() => confirm(`Delete ${node.name}?`) && act({ action: "deleteNode", id: node.id })}>🗑</button>
          </div>
          {!node.managerEmail && <p className="field-hint" style={{ margin: "6px 0 0" }}>No one chosen yet, so cases skip this step.</p>}
          {!childTier && nodeBranches(node.id).length > 0 && (
            <p className="subtitle" style={{ margin: "8px 0 0" }}>
              Branches: {nodeBranches(node.id).map((b) => b.name).join(", ")}
            </p>
          )}
          {childTier && (
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-sm" onClick={() => setOpen((v) => !v)}>{open ? "Close" : `+ Add ${childTier.name.toLowerCase()}s under ${node.name}`}</button>
              {open && (
                <div style={{ marginTop: 8 }}>
                  <textarea rows={3} placeholder={`One ${childTier.name.toLowerCase()} per line`} value={names} onChange={(e) => setNames(e.target.value)} style={{ width: "100%" }} />
                  <button className="btn btn-dark btn-sm" disabled={busy || !names.trim()} onClick={async () => { if (await act({ action: "addNode", tierKey: childTier.key, parentNodeId: node.id, names: names.split("\n") })) { setNames(""); setOpen(false); } }}>Add</button>
                </div>
              )}
            </div>
          )}
          {!childTier && (
            <div style={{ marginTop: 8 }}>
              <label className="field-hint">Branches in this {tierName.toLowerCase()}</label>
              <select
                value=""
                onChange={(e) => e.target.value && act({ action: "moveBranch", businessId: e.target.value, orgNodeId: node.id })}
              >
                <option value="">+ Put a branch here…</option>
                {data!.branches.filter((b) => b.orgNodeId !== node.id).map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select>
            </div>
          )}
        </div>
        {kids.map((k) => (<NodeBox key={k.id} node={k} depth={depth + 1} />))}
      </div>
    );
  }

  function AddTopNodes() {
    const first = data!.tiers[0];
    const [names, setNames] = useState("");
    if (!first) return null;
    return (
      <div style={{ marginTop: 10 }}>
        <textarea rows={3} placeholder={`Add ${first.name.toLowerCase()}s, one per line (for example North, South)`} value={names} onChange={(e) => setNames(e.target.value)} style={{ width: "100%" }} />
        <button className="btn btn-dark btn-sm" disabled={busy || !names.trim()} onClick={async () => { if (await act({ action: "addNode", tierKey: first.key, parentNodeId: null, names: names.split("\n") })) setNames(""); }}>Add {first.name.toLowerCase()}s</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {heading && <h1>Escalation and structure</h1>}
      <p className="subtitle">
        {isGroup
          ? "Build your structure from the top down. When a case is escalated it moves one step up: the branch manager, then each box above the branch that has someone chosen, then your group team. Each step shows a name and email before anyone clicks Escalate."
          : "Choose who a case goes to when you escalate it, in order. The first person is you."}
      </p>
      {error && <p className="error-text">{error}</p>}
      {notice && <div className="callout" role="status">{notice}</div>}

      {/* 1. Group and team */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>{isGroup ? "1. Group head and group team" : "Who handles escalations"}</h3>
        <p className="card-sub" style={{ margin: "0 0 10px" }}>
          {isGroup
            ? "The top of the chain, in order from the first group-level step to the last. If you add no one, cases end with the group owner."
            : "In order. Each Escalate press moves the case to the next person."}
        </p>
        {data.groupSteps.map((g, i) => (
          <div key={i} className="field-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ flex: 1, minWidth: 150 }}>
              <label>Title</label>
              <input type="text" defaultValue={g.title} onBlur={(e) => e.target.value !== g.title && saveSteps(data.groupSteps.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)))} />
            </div>
            <div className="field" style={{ flex: 1.4, minWidth: 190 }}>
              <label>Email</label>
              <PersonSelect value={g.email} onChange={(email) => saveSteps(data.groupSteps.map((s, j) => (j === i ? { ...s, email } : s)))} />
            </div>
            <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => { const a = [...data.groupSteps]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; saveSteps(a); }}>↑</button>
            <button className="icon-btn" title="Move down" disabled={i === data.groupSteps.length - 1} onClick={() => { const a = [...data.groupSteps]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; saveSteps(a); }}>↓</button>
            <button className="icon-btn btn-danger" title="Remove" onClick={() => saveSteps(data.groupSteps.filter((_, j) => j !== i))}>🗑</button>
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => saveSteps([...data.groupSteps.filter((s) => s.email), { title: isGroup ? "Group Head" : "Escalation contact", email: "" }])} style={{ marginTop: 6 }}>
          + Add {data.groupSteps.length ? "another step" : isGroup ? "group head or team member" : "a person"}
        </button>
        <p className="field-hint" style={{ marginTop: 8 }}>
          People come from your team (team members{isGroup ? " and branch owners" : ""}). To add someone new, ask your OodelCX account manager to add them as a team member first.
        </p>
      </div>

      {/* 2. Levels */}
      {isGroup && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>2. Levels between the group and your branches</h3>
          <p className="card-sub" style={{ margin: "0 0 10px" }}>
            Use only the levels you have, named in your own words (Region, Area, Cluster, Zone, District). No levels at all is fine: branches then sit directly under the group.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {data.tiers.map((t, i) => (
              <span key={t.key} className="pill pill-gray" style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: "4px 10px" }}>
                <input type="text" defaultValue={t.name} style={{ width: 90, border: 0, background: "transparent", padding: 0 }} aria-label="Level name" onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && saveTiers(data.tiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <button className="icon-btn" title="Remove this level" onClick={() => saveTiers(data.tiers.filter((_, j) => j !== i))}>×</button>
              </span>
            ))}
            <span className="pill pill-green">Branch</span>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Region", "Area", "Cluster"].filter((n) => !data.tiers.some((t) => t.name === n)).map((n) => (
              <button key={n} className="btn btn-sm" onClick={() => saveTiers([...data.tiers, { key: "", name: n }])}>+ {n}</button>
            ))}
            <button className="btn btn-sm" onClick={() => { const name = prompt("Name of the level (for example Zone)"); if (name?.trim()) saveTiers([...data.tiers, { key: "", name }]); }}>+ Other…</button>
          </div>
          <div className="field" style={{ maxWidth: 280, marginTop: 12 }}>
            <label>What is the person who runs a branch called?</label>
            <input type="text" defaultValue={data.branchTitle} onBlur={(e) => e.target.value.trim() && e.target.value !== data.branchTitle && act({ action: "saveSettings", branchTitle: e.target.value })} />
          </div>
        </div>
      )}

      {/* 3. The tree */}
      {isGroup && data.tiers.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>3. Your {data.tiers.map((t) => t.name.toLowerCase()).join(", then ")}</h3>
          <p className="card-sub" style={{ margin: "0 0 4px" }}>
            Add the boxes, say who handles escalations in each, and put your branches in the lowest level{lowestTier ? ` (${lowestTier.name.toLowerCase()})` : ""}.
          </p>
          {topNodes(data.tiers[0].key).filter((n) => !n.parentNodeId).map((n) => (<NodeBox key={n.id} node={n} depth={0} />))}
          <AddTopNodes />
          {unassigned.length > 0 && (
            <div className="callout callout-amber" style={{ marginTop: 14 }}>
              {unassigned.length} branch{unassigned.length === 1 ? " is" : "es are"} not in a {lowestTier?.name.toLowerCase()} yet, so their cases skip those steps: {unassigned.slice(0, 6).map((b) => b.name).join(", ")}
              {unassigned.length > 6 ? ` and ${unassigned.length - 6} more` : ""}. Use "Put a branch here" in the {lowestTier?.name.toLowerCase()} boxes above.
            </div>
          )}
        </div>
      )}

      {/* 4. Timing */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>{isGroup ? "4. How long before a case moves up on its own?" : "How long before a case moves up on its own?"}</h3>
        <div className="field-row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ maxWidth: 220 }}>
            <label>Hours at each step</label>
            <input type="number" min="1" defaultValue={data.slaHours ?? ""} placeholder="Leave empty for manual only" onBlur={(e) => act({ action: "saveSettings", slaHours: e.target.value.trim() ? Number(e.target.value) : null })} />
          </div>
        </div>
        <p className="field-hint">If a case is not resolved within this time at a step, it moves up to the next person automatically. Leave empty to escalate by hand only.</p>
        {isGroup && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer" }}>Different times for different steps</summary>
            <div className="field-row" style={{ flexWrap: "wrap", marginTop: 8 }}>
              {[{ key: "branch", name: data.branchTitle }, ...data.tiers, { key: "group", name: "Group team" }].map((t) => (
                <div className="field" key={t.key} style={{ width: 150 }}>
                  <label>{t.name} (hours)</label>
                  <input type="number" min="1" defaultValue={data.slaByTier[t.key] ?? ""} placeholder={String(data.slaHours ?? "")} onBlur={(e) => act({ action: "saveSettings", slaByTier: { ...data.slaByTier, [t.key]: e.target.value.trim() ? Number(e.target.value) : 0 } })} />
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* 5. Preview */}
      <div className="card">
        <h3>Check the chain</h3>
        {isGroup ? (
          <div className="field" style={{ maxWidth: 360 }}>
            <label>Pick a branch to see who a case would go to, step by step</label>
            <select value={previewBranch} onChange={(e) => setPreviewBranch(e.target.value)}>
              <option value="">Choose a branch…</option>
              {data.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select>
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            <button className="btn btn-sm" onClick={() => act({ action: "preview", businessId: "self" })}>Show the chain</button>
          </div>
        )}
        {preview && (
          <ol style={{ margin: "12px 0 0", paddingLeft: 20 }}>
            {preview.steps.map((s) => (
              <li key={s.level} style={{ marginBottom: 4 }}>
                <b>{s.label}</b> {s.email ? <>— {s.email}</> : <span className="field-hint">no one chosen yet</span>}
                {s.hours ? <span className="field-hint"> · moves up after {s.hours}h</span> : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
