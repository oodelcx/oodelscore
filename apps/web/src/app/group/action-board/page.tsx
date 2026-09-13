"use client";

import { Fragment, useEffect, useState } from "react";

interface ItemRow {
  _id: string;
  title: string;
  description: string;
  businessId: string;
  categoryId: string | null;
  ownerId: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  resolutionNote: string;
  resolvedAt: string | null;
  source: string;
}
interface PlaybookRow {
  _id: string;
  categoryId: string | null;
  title: string;
  triggerCondition: string;
  steps: string[];
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  auto_suggested: "AI suggested",
  auto_assigned: "AI auto-assigned",
  escalated: "Escalated",
};
interface BusinessRow {
  _id: string;
  name: string;
  region?: string;
}
interface TeamRow {
  userId: string;
  label: string;
}

export default function ActionBoardPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tier, setTier] = useState<"full" | "limited" | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [expandedPlaybookFor, setExpandedPlaybookFor] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unassigned" | "overdue" | "resolved">("all");
  const [regionFilter, setRegionFilter] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/group/action-board").then((r) => r.json()),
      fetch("/api/group/businesses").then((r) => r.json()),
      fetch("/api/group/team").then((r) => r.json()),
    ]).then(([itemsData, businessesData, teamData]) => {
      setItems(itemsData.items ?? []);
      setPlaybooks(itemsData.playbooks ?? []);
      setTier(itemsData.tier ?? null);
      setBusinesses(businessesData.businesses ?? []);
      setTeam(teamData.team ?? []);
      setBusinessId((current) => current || businessesData.businesses?.[0]?._id || "");
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  function playbookForCategory(categoryId: string | null) {
    if (!categoryId) return null;
    return playbooks.find((p) => p.categoryId === categoryId) ?? null;
  }

  function startResolve(id: string) {
    setResolvingId(id);
    setResolutionDraft("");
    setResolutionError(null);
  }

  function cancelResolve() {
    setResolvingId(null);
    setResolutionDraft("");
    setResolutionError(null);
  }

  async function confirmResolve(id: string) {
    if (!resolutionDraft.trim()) {
      setResolutionError("Describe what you did about this before marking it resolved.");
      return;
    }
    await updateItem(id, { status: "resolved", resolutionNote: resolutionDraft.trim() });
    setResolvingId(null);
    setResolutionDraft("");
    setResolutionError(null);
  }

  async function createItem() {
    if (!title.trim() || !businessId) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/group/action-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, businessId, priority, ownerId: ownerId || null, dueDate: dueDate || null }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setTitle("");
    setOwnerId("");
    setDueDate("");
    load();
  }

  async function updateItem(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/group/action-board/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  function businessName(id: string) {
    return businesses.find((b) => b._id === id)?.name ?? "—";
  }

  function isOverdue(item: ItemRow) {
    return !!item.dueDate && new Date(item.dueDate) < new Date() && item.status !== "resolved";
  }

  const isLimited = tier === "limited";
  const regions = Array.from(new Set(businesses.map((b) => b.region).filter((r): r is string => !!r))).sort();

  const openCount = items.filter((i) => i.status === "open").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;
  const overdueCount = items.filter(isOverdue).length;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const resolved30dCount = items.filter((i) => i.status === "resolved" && i.resolvedAt && new Date(i.resolvedAt).getTime() >= thirtyDaysAgo).length;

  const visibleItems = items.filter((item) => {
    if (regionFilter) {
      const region = businesses.find((b) => b._id === item.businessId)?.region;
      if (region !== regionFilter) return false;
    }
    if (filter === "unassigned") return !item.ownerId;
    if (filter === "overdue") return isOverdue(item);
    if (filter === "resolved") return item.status === "resolved";
    return true;
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{isLimited ? "My Action Items" : "Action Board"}</h1>
          <p className="subtitle">
            {isLimited
              ? "Items assigned to you — update their status as you work through them."
              : "Work items spawned from flagged feedback across your businesses, including AI-suggested ones from Alert Rules."}
          </p>
        </div>
      </div>

      {!isLimited && (
        <div className="grid grid-4" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="metric-label">Open</div>
            <div className="metric-val">{openCount}</div>
          </div>
          <div className="card">
            <div className="metric-label">In progress</div>
            <div className="metric-val">{inProgressCount}</div>
          </div>
          <div className="card" style={{ background: "var(--red-bg)" }}>
            <div className="metric-label" style={{ color: "var(--red)" }}>Overdue</div>
            <div className="metric-val" style={{ color: "var(--red)" }}>{overdueCount}</div>
          </div>
          <div className="card">
            <div className="metric-label">Resolved (30d)</div>
            <div className="metric-val">{resolved30dCount}</div>
          </div>
        </div>
      )}

      {!isLimited && (
        <div className="filters">
          {(["all", "unassigned", "overdue", "resolved"] as const).map((f) => (
            <div key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </div>
          ))}
          {regions.length > 0 && (
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="">All regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {!isLimited && (
      <div className="card">
        <h3>New action item</h3>
        <div className="field-row">
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Business</label>
            <select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              {businesses.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Owner (optional)</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Unassigned</option>
              {team.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Due date (optional)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createItem}>
          {creating ? "Creating…" : "+ Log action"}
        </button>
      </div>
      )}

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Title</th>
              {!isLimited && <th>Business</th>}
              {!isLimited && <th>Owner</th>}
              {!isLimited && <th>Priority</th>}
              <th>Source</th>
              <th>Status</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(isLimited ? items : visibleItems).map((item) => {
              const playbook = playbookForCategory(item.categoryId);
              const colCount = isLimited ? 4 : 7;
              return (
                <Fragment key={item._id}>
                  <tr>
                    <td>
                      {item.title}
                      {item.description && <div className="card-sub" style={{ margin: "2px 0 0" }}>{item.description}</div>}
                      {playbook && (
                        <button
                          className="btn btn-sm"
                          style={{ marginTop: 6 }}
                          onClick={() => setExpandedPlaybookFor(expandedPlaybookFor === item._id ? null : item._id)}
                        >
                          {expandedPlaybookFor === item._id ? "Hide playbook" : "📘 Playbook: " + playbook.title}
                        </button>
                      )}
                    </td>
                    {!isLimited && <td>{businessName(item.businessId)}</td>}
                    {!isLimited && (
                      <td>
                        <select value={item.ownerId ?? ""} onChange={(e) => updateItem(item._id, { ownerId: e.target.value || null })}>
                          <option value="">Unassigned</option>
                          {team.map((t) => (
                            <option key={t.userId} value={t.userId}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    {!isLimited && (
                      <td>
                        <select value={item.priority} onChange={(e) => updateItem(item._id, { priority: e.target.value })}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </td>
                    )}
                    <td>
                      <span className={`pill ${item.source === "manual" ? "pill-gray" : "pill-purple"}`}>
                        {SOURCE_LABELS[item.source] ?? item.source}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${item.status === "resolved" ? "pill-green" : "pill-amber"}`}>{item.status}</span>
                    </td>
                    <td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {item.status !== "resolved" && resolvingId !== item._id && (
                        <button className="btn btn-sm" onClick={() => startResolve(item._id)}>
                          Mark resolved
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedPlaybookFor === item._id && playbook && (
                    <tr>
                      <td colSpan={colCount} style={{ background: "var(--bg-2, #f7f7f8)" }}>
                        <div className="card-sub" style={{ margin: "4px 0" }}>
                          <b>Trigger:</b> {playbook.triggerCondition || "—"}
                        </div>
                        <ul style={{ margin: "4px 0 6px", paddingLeft: 18, fontSize: "12.5px", color: "var(--text-2)" }}>
                          {playbook.steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                  {resolvingId === item._id && (
                    <tr>
                      <td colSpan={colCount}>
                        <div className="field" style={{ margin: "6px 0" }}>
                          <label>What did you do about this?</label>
                          <textarea
                            value={resolutionDraft}
                            onChange={(e) => setResolutionDraft(e.target.value)}
                            autoFocus
                            placeholder="Describe the action taken — this is logged to the Decision Log automatically."
                          />
                        </div>
                        {resolutionError && <p className="error-text">{resolutionError}</p>}
                        <button className="btn btn-dark btn-sm" onClick={() => confirmResolve(item._id)}>
                          Confirm resolved
                        </button>{" "}
                        <button className="btn btn-sm" onClick={cancelResolve}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {(isLimited ? items : visibleItems).length === 0 && (
              <tr>
                <td colSpan={isLimited ? 4 : 7} className="subtitle">
                  {items.length === 0 ? "No action items yet." : "No items match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
