"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InfoTip } from "@/components/info-tip";
import { OwnerBadge } from "@/components/owner-badge";
import { PlaybookRunPanelSlideout } from "@/components/playbook-run-panel-slideout";
import { useTooltips } from "@/lib/useTooltips";

interface PlaybookRunSummary {
  id: string;
  playbookId: string;
  playbookTitle: string;
  categoryId: string | null;
  stepsTotal: number;
  stepsCompleted: number;
  status: "active" | "completed" | "abandoned";
  attachReason: string;
}
interface ItemRow {
  _id: string;
  title: string;
  description: string;
  categoryId: string | null;
  ownerId: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  resolutionNote: string;
  suggestedAction: string;
  rating: number | null;
  playbookRun?: PlaybookRunSummary | null;
}
interface TeamRow {
  userId: string;
  label: string;
}
interface PlaybookRow {
  _id: string;
  categoryId: string | null;
  title: string;
  triggerCondition: string;
  steps: string[];
}
interface CategoryRow {
  _id: string;
  name: string;
}
interface CommentRow {
  _id: string;
  authorLabel: string;
  body: string;
  createdAt: string;
}
interface Stats {
  open: number;
  inProgress: number;
  overdue: number;
  escalated: number;
  resolved30d: number;
  avgResolutionHours: number | null;
}

const CASES_PAGE_SIZE = 10;

function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  if (hours >= 24) return `${(hours / 24).toFixed(1)}d`;
  return `${hours.toFixed(1)}h`;
}

function formatSpan(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours >= 24) return `${Math.round(hours / 24)}d`;
  return `${Math.max(1, Math.round(hours))}h`;
}

// Age/SLA badge next to the status pill — "Open Xh/Xd" for anything still
// open, or "Overdue by Xh/Xd" once it's past its due date, so urgency is
// visible without reading the due-date field in the meta row.
function ageBadge(item: ItemRow): { label: string; overdue: boolean } {
  if (item.dueDate && item.status !== "resolved" && new Date(item.dueDate) < new Date()) {
    return { label: `Overdue by ${formatSpan(Date.now() - new Date(item.dueDate).getTime())}`, overdue: true };
  }
  return { label: `Open ${formatSpan(Date.now() - new Date(item.createdAt).getTime())}`, overdue: false };
}

// The star rating from the case's source feedback response — null when the
// case wasn't generated from a rated response (e.g. logged manually).
function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return null;
  return (
    <span className="case-stars" aria-label={`${rating} of 5 stars`}>
      {"★".repeat(rating)}
      <span className="case-stars-empty">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function BusinessCasesClient() {
  const tooltips = useTooltips("action-board");
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tier, setTier] = useState<"full" | "limited" | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [expandedCommentsFor, setExpandedCommentsFor] = useState<string | null>(null);
  const [commentsByItem, setCommentsByItem] = useState<Record<string, CommentRow[]>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [filter, setFilter] = useState<"all" | "unassigned" | "overdue" | "resolved">("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [openRunFor, setOpenRunFor] = useState<{ itemId: string; runId: string } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [filter, categoryFilter, search]);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/business/action-board").then((r) => r.json()),
      fetch("/api/business/team").then((r) => r.json()),
      fetch("/api/business/category-owners").then((r) => r.json()).catch(() => ({ categories: [] })),
    ]).then(([itemsData, teamData, categoryData]) => {
      setItems(itemsData.items ?? []);
      setPlaybooks(itemsData.playbooks ?? []);
      setTier(itemsData.tier ?? null);
      setStats(itemsData.stats ?? null);
      setTeam(teamData.team ?? []);
      setCategories(categoryData.categories ?? []);
      setLoading(false);
    });
  }

  useEffect(load, []);

  function categoryName(id: string | null): string {
    if (!id) return "Any category";
    return categories.find((c) => c._id === id)?.name ?? "Uncategorized";
  }

  function playbookForCategory(categoryId: string | null) {
    if (!categoryId) return null;
    return playbooks.find((p) => p.categoryId === categoryId) ?? null;
  }

  function isOverdue(item: ItemRow) {
    return !!item.dueDate && new Date(item.dueDate) < new Date() && item.status !== "resolved";
  }

  function startResolve(id: string) {
    setResolvingId(id);
    setResolutionDraft("");
    setResolutionError(null);
    setOpenRunFor(null);
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
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/business/action-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, priority, ownerId: ownerId || null, dueDate: dueDate || null }),
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
    setShowCreateForm(false);
    load();
  }

  async function updateItem(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/business/action-board/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function toggleComments(id: string) {
    if (expandedCommentsFor === id) {
      setExpandedCommentsFor(null);
      return;
    }
    setExpandedCommentsFor(id);
    setCommentDraft("");
    if (!commentsByItem[id]) {
      const data = await fetch(`/api/business/action-board/${id}/comments`).then((r) => r.json());
      setCommentsByItem((prev) => ({ ...prev, [id]: data.comments ?? [] }));
    }
  }

  async function postComment(id: string) {
    if (!commentDraft.trim()) return;
    setPostingComment(true);
    const res = await fetch(`/api/business/action-board/${id}/comments`, {
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

  function logDecision(ctx: { title: string; trigger: string; linkedCaseId: string }) {
    const params = new URLSearchParams({ new: "1", title: ctx.title, trigger: ctx.trigger, linkedCaseId: ctx.linkedCaseId });
    setOpenRunFor(null);
    router.push(`/business/decision-log?${params.toString()}`);
  }

  const isLimited = tier === "limited";

  const openCount = stats?.open ?? items.filter((i) => i.status === "open").length;
  const inProgressCount = stats?.inProgress ?? items.filter((i) => i.status === "in_progress").length;
  const overdueCount = stats?.overdue ?? items.filter(isOverdue).length;
  const resolved30dCount = stats?.resolved30d ?? items.filter((i) => i.status === "resolved" && i.resolutionNote).length;

  const visibleItems = items.filter((item) => {
    if (categoryFilter && item.categoryId !== categoryFilter) return false;
    if (filter === "unassigned") return !item.ownerId;
    if (filter === "overdue") return isOverdue(item);
    if (filter === "resolved") return item.status === "resolved";
    if (search && !`${item.title} ${item.description}`.toLowerCase().includes(search)) return false;
    return true;
  });

  const pageableItems = isLimited ? items : visibleItems;
  const totalPages = Math.max(1, Math.ceil(pageableItems.length / CASES_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = pageableItems.slice((currentPage - 1) * CASES_PAGE_SIZE, currentPage * CASES_PAGE_SIZE);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{isLimited ? "My Cases" : "Case Management"}</h1>
          <p className="subtitle">
            {isLimited
              ? "Cases assigned to you — update their status as you work through them."
              : "Cases spawned from flagged feedback — Alert Rules create these automatically and assign them to whoever owns that category. A matching Playbook attaches automatically."}
          </p>
        </div>
        <div className="page-head-actions">
          <a className="link-action" href="/business/playbooks">
            ⚙ Playbook Library
          </a>
          {!isLimited && (
            <button className="btn btn-dark" onClick={() => setShowCreateForm((v) => !v)}>
              {showCreateForm ? "Cancel" : "+ New case"}
            </button>
          )}
        </div>
      </div>

      {!isLimited && (
        <div className="grid grid-5 kpi-strip" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="metric-label">Open</div>
            <div className="metric-val">{openCount}</div>
          </div>
          <div className="card">
            <div className="metric-label">In progress</div>
            <div className="metric-val">{inProgressCount}</div>
          </div>
          <div className="card" style={{ background: "var(--red-bg)" }}>
            <div className="metric-label" style={{ color: "var(--red)" }}>
              Overdue
              <InfoTip text={tooltips["due-date"]} />
            </div>
            <div className="metric-val" style={{ color: "var(--red)" }}>
              {overdueCount}
            </div>
          </div>
          <div className="card">
            <div className="metric-label">Resolved (30d)</div>
            <div className="metric-val">{resolved30dCount}</div>
          </div>
          <div className="card">
            <div className="metric-label">Avg time to resolve</div>
            <div className="metric-val">{formatHours(stats?.avgResolutionHours ?? null)}</div>
          </div>
        </div>
      )}

      {!isLimited && showCreateForm && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>New case</h3>
          <div className="field-row">
            <div className="field">
              <label>
                Title <InfoTip text={tooltips["item-title"]} />
              </label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>
                Priority <InfoTip text={tooltips["priority"]} />
              </label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="field">
              <label>
                Owner (optional) <InfoTip text={tooltips["owner"]} />
              </label>
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
              <label>
                Due date (optional) <InfoTip text={tooltips["due-date"]} />
              </label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-dark" disabled={creating} onClick={createItem}>
            {creating ? "Creating…" : "+ New case"}
          </button>
        </div>
      )}

      {!isLimited && (
        <div className="filters">
          {(["all", "unassigned", "overdue", "resolved"] as const).map((f) => (
            <div key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </div>
          ))}
          {categories.length > 0 && (
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search cases by title or description…"
            style={{ minWidth: 220 }}
          />
        </div>
      )}

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <div className="ab-list">
          {pagedItems.map((item) => {
            const overdue = isOverdue(item);
            const run = item.playbookRun ?? null;
            const age = item.status === "resolved" ? null : ageBadge(item);
            const severityClass = item.priority === "critical" ? " sev-critical" : item.priority === "high" ? " sev-high" : "";
            return (
              <Fragment key={item._id}>
                <div className={`card ab-card${severityClass}${overdue ? " overdue" : ""}`}>
                  <div className="ab-card-head">
                    <div className="ab-title-block">
                      <div className="ab-title">{item.title}</div>
                      {!isLimited && (
                        <div className="ab-meta-row">
                          <Stars rating={item.rating} />
                          {item.categoryId && (
                            <span className="pill pill-gray">{categoryName(item.categoryId)}</span>
                          )}
                          <span>
                            Due: <b>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"}</b>
                          </span>
                        </div>
                      )}
                      {item.description && <div className="ab-desc">{item.description}</div>}
                      {item.suggestedAction && (
                        <div className="ab-callout">
                          <b>Suggested:</b> {item.suggestedAction}
                          {!isLimited && (
                            <div style={{ marginTop: 4 }}>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() =>
                                  updateItem(item._id, {
                                    description: item.description ? `${item.description}\n\n${item.suggestedAction}` : item.suggestedAction,
                                    suggestedAction: "",
                                  })
                                }
                              >
                                Accept
                              </button>{" "}
                              <button type="button" className="btn btn-sm" onClick={() => updateItem(item._id, { suggestedAction: "" })}>
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="ab-actions-col">
                      <div className="ab-badges">
                        <span className={`pill ${item.status === "resolved" ? "pill-green" : "pill-amber"}`}>
                          {item.status.replace(/_/g, " ")}
                        </span>
                        {age && <span className={`pill ${age.overdue ? "pill-red" : "pill-gray"}`}>{age.label}</span>}
                        {!isLimited && (
                          <span className={`pill pill-${item.priority === "critical" || item.priority === "high" ? "amber" : "gray"}`}>
                            {item.priority}
                          </span>
                        )}
                      </div>
                      {item.status !== "resolved" && resolvingId !== item._id && (
                        <button className="btn btn-sm" onClick={() => startResolve(item._id)}>
                          Mark resolved
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="case-footer">
                    <div className="case-footer-actions">
                      {run ? (
                        <div className="pb-chip" onClick={() => setOpenRunFor({ itemId: item._id, runId: run.id })}>
                          <span>
                            Playbook: {run.stepsCompleted} of {run.stepsTotal} steps
                          </span>
                          <span className="pb-chip-track">
                            <span
                              className="pb-chip-fill"
                              style={{ width: `${run.stepsTotal ? Math.round((run.stepsCompleted / run.stepsTotal) * 100) : 0}%` }}
                            />
                          </span>
                        </div>
                      ) : item.categoryId ? (
                        <span className="pb-no-playbook">
                          No playbook set — <a href="/business/playbooks">create one</a>
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className={`case-action-btn${expandedCommentsFor === item._id ? " active" : ""}`}
                        onClick={() => toggleComments(item._id)}
                      >
                        💬 Comments{commentsByItem[item._id] ? ` (${commentsByItem[item._id].length})` : ""}
                      </button>
                    </div>
                    {!isLimited && <OwnerBadge label={team.find((t) => t.userId === item.ownerId)?.label ?? null} tip={tooltips["owner"]} />}
                  </div>

                  {expandedCommentsFor === item._id && (
                    <div className="ab-panel">
                      {(commentsByItem[item._id] ?? []).length === 0 ? (
                        <p className="subtitle" style={{ margin: "0 0 8px" }}>
                          No comments yet — start the trail below.
                        </p>
                      ) : (
                        <ul style={{ margin: "0 0 8px", paddingLeft: 0, listStyle: "none" }}>
                          {(commentsByItem[item._id] ?? []).map((c) => (
                            <li key={c._id} style={{ marginBottom: 8, fontSize: "12.5px" }}>
                              <b>{c.authorLabel}</b> <span style={{ color: "var(--text-3)" }}>{new Date(c.createdAt).toLocaleString()}</span>
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
                        <button className="btn btn-sm btn-dark" disabled={postingComment || !commentDraft.trim()} onClick={() => postComment(item._id)}>
                          {postingComment ? "Posting…" : "Post"}
                        </button>
                      </div>
                    </div>
                  )}

                  {resolvingId === item._id && (
                    <div className="ab-panel">
                      <div className="field" style={{ margin: 0 }}>
                        <label>
                          What did you do about this? <InfoTip text={tooltips["resolution-note"]} />
                        </label>
                        <textarea
                          value={resolutionDraft}
                          onChange={(e) => setResolutionDraft(e.target.value)}
                          autoFocus
                          placeholder="Describe the action taken — this is logged to the Decision Log automatically."
                        />
                      </div>
                      {resolutionError && <p className="error-text">{resolutionError}</p>}
                      <button className="btn btn-dark btn-sm" style={{ marginTop: 8 }} onClick={() => confirmResolve(item._id)}>
                        Confirm resolved
                      </button>{" "}
                      <button className="btn btn-sm" onClick={cancelResolve}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
          {pageableItems.length === 0 && (
            <div className="ab-empty">{items.length === 0 ? "No cases yet." : "No cases match this filter."}</div>
          )}
        </div>
      )}

      {!loading && pageableItems.length > 0 && totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ← Prev
          </button>
          <span className="pagination-status">
            Page {currentPage} of {totalPages} · {pageableItems.length} case{pageableItems.length === 1 ? "" : "s"}
          </span>
          <button className="btn btn-sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next →
          </button>
        </div>
      )}

      {openRunFor && (
        <PlaybookRunPanelSlideout
          runId={openRunFor.runId}
          basePath="business"
          categoryName={categoryName}
          onClose={() => setOpenRunFor(null)}
          onChanged={load}
          libraryHref="/business/playbooks"
          onLogDecision={logDecision}
          onResolveCase={() => {
            const itemId = openRunFor.itemId;
            setOpenRunFor(null);
            startResolve(itemId);
          }}
        />
      )}
    </div>
  );
}
