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
  escalated: boolean;
}
interface PlaybookRow {
  _id: string;
  categoryId: string | null;
  title: string;
  triggerCondition: string;
  steps: string[];
}
interface BusinessRow {
  _id: string;
  name: string;
  region?: string;
}
interface TeamRow {
  userId: string;
  label: string;
}
interface CommentRow {
  _id: string;
  authorLabel: string;
  body: string;
  createdAt: string;
}

export default function ActionBoardPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"full" | "limited" | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [expandedPlaybookFor, setExpandedPlaybookFor] = useState<string | null>(null);
  const [expandedCommentsFor, setExpandedCommentsFor] = useState<string | null>(null);
  const [commentsByItem, setCommentsByItem] = useState<Record<string, CommentRow[]>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [escalating, setEscalating] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unassigned" | "overdue" | "resolved" | "escalated">("all");
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

  async function updateItem(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/group/action-board/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function toggleEscalated(item: ItemRow) {
    setEscalating(item._id);
    await updateItem(item._id, { escalated: !item.escalated });
    setEscalating(null);
  }

  async function toggleComments(id: string) {
    if (expandedCommentsFor === id) {
      setExpandedCommentsFor(null);
      return;
    }
    setExpandedCommentsFor(id);
    setCommentDraft("");
    if (!commentsByItem[id]) {
      const data = await fetch(`/api/group/action-board/${id}/comments`).then((r) => r.json());
      setCommentsByItem((prev) => ({ ...prev, [id]: data.comments ?? [] }));
    }
  }

  async function postComment(id: string) {
    if (!commentDraft.trim()) return;
    setPostingComment(true);
    const res = await fetch(`/api/group/action-board/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentDraft.trim() }),
    });
    const data = await res.json().catch(() => null);
    setPostingComment(false);
    if (res.ok && data?.comment) {
      setCommentsByItem((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), data.comment] }));
      setCommentDraft("");
    }
  }

  function businessName(id: string) {
    return businesses.find((b) => b._id === id)?.name ?? "—";
  }

  function ownerLabel(id: string | null) {
    if (!id) return "Unassigned";
    return team.find((t) => t.userId === id)?.label ?? "—";
  }

  function isOverdue(item: ItemRow) {
    return !!item.dueDate && new Date(item.dueDate) < new Date() && item.status !== "resolved";
  }

  const isLimited = tier === "limited";
  const regions = Array.from(new Set(businesses.map((b) => b.region).filter((r): r is string => !!r))).sort();

  const openCount = items.filter((i) => i.status === "open").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;
  const overdueCount = items.filter(isOverdue).length;
  const escalatedCount = items.filter((i) => i.escalated).length;
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
    if (filter === "escalated") return item.escalated;
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
              : "Read-only oversight of every branch's Action Board — assigning and resolving items is each branch's own job. Comment on an item or flag it Escalated if it needs your attention."}
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
          {(["all", "unassigned", "overdue", "resolved", "escalated"] as const).map((f) => (
            <div key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "escalated" ? `Escalated (${escalatedCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
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

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean striped">
          <thead>
            <tr>
              <th>Title</th>
              {!isLimited && <th>Business</th>}
              <th>Owner</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(isLimited ? items : visibleItems).map((item) => {
              const playbook = playbookForCategory(item.categoryId);
              const colCount = isLimited ? 5 : 6;
              return (
                <Fragment key={item._id}>
                  <tr>
                    <td>
                      {item.escalated && (
                        <span className="pill pill-red" style={{ marginRight: 6 }}>
                          Escalated
                        </span>
                      )}
                      {item.title}
                      {item.description && <div className="card-sub" style={{ margin: "2px 0 0" }}>{item.description}</div>}
                      <div className="action-links">
                        <button
                          type="button"
                          className={`btn btn-sm action-btn${expandedPlaybookFor === item._id ? " active" : ""}`}
                          disabled={!playbook}
                          title={playbook ? undefined : "No playbook set for this category"}
                          onClick={() => setExpandedPlaybookFor(expandedPlaybookFor === item._id ? null : item._id)}
                        >
                          📘 Playbook
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm action-btn${expandedCommentsFor === item._id ? " active" : ""}`}
                          onClick={() => toggleComments(item._id)}
                        >
                          💬 Comments{commentsByItem[item._id] ? ` (${commentsByItem[item._id].length})` : ""}
                        </button>
                      </div>
                    </td>
                    {!isLimited && <td>{businessName(item.businessId)}</td>}
                    <td>{isLimited ? ownerLabel(item.ownerId) : ownerLabel(item.ownerId)}</td>
                    <td>
                      <span className={`pill pill-${item.priority === "critical" || item.priority === "high" ? "amber" : "gray"}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${item.status === "resolved" ? "pill-green" : "pill-amber"}`}>{item.status}</span>
                    </td>
                    <td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {isLimited && item.status !== "resolved" && resolvingId !== item._id && (
                        <button className="btn btn-sm" onClick={() => startResolve(item._id)}>
                          Mark resolved
                        </button>
                      )}
                      {!isLimited && (
                        <button
                          className={`btn btn-sm${item.escalated ? " btn-dark" : ""}`}
                          disabled={escalating === item._id}
                          onClick={() => toggleEscalated(item)}
                        >
                          {item.escalated ? "Un-escalate" : "Escalate"}
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
                  {expandedCommentsFor === item._id && (
                    <tr>
                      <td colSpan={colCount} style={{ background: "var(--bg-2, #f7f7f8)" }}>
                        <div style={{ margin: "6px 0" }}>
                          {(commentsByItem[item._id] ?? []).length === 0 ? (
                            <p className="subtitle" style={{ margin: "0 0 8px" }}>
                              No comments yet — start the trail below.
                            </p>
                          ) : (
                            <ul style={{ margin: "0 0 8px", paddingLeft: 0, listStyle: "none" }}>
                              {(commentsByItem[item._id] ?? []).map((c) => (
                                <li key={c._id} style={{ marginBottom: 8, fontSize: "12.5px" }}>
                                  <b>{c.authorLabel}</b>{" "}
                                  <span style={{ color: "var(--text-3)" }}>{new Date(c.createdAt).toLocaleString()}</span>
                                  <div style={{ color: "var(--text-2)" }}>{c.body}</div>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="field-row" style={{ alignItems: "flex-end" }}>
                            <div className="field" style={{ margin: 0, flex: 1 }}>
                              <textarea
                                placeholder="Add a note for whoever's on this item…"
                                value={commentDraft}
                                onChange={(e) => setCommentDraft(e.target.value)}
                              />
                            </div>
                            <button
                              className="btn btn-sm btn-dark"
                              disabled={postingComment || !commentDraft.trim()}
                              onClick={() => postComment(item._id)}
                            >
                              {postingComment ? "Posting…" : "Post"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {isLimited && resolvingId === item._id && (
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
                <td colSpan={isLimited ? 5 : 6} className="subtitle">
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
