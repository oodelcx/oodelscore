"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InfoTip } from "@/components/info-tip";
import { OwnerBadge } from "@/components/owner-badge";
import { PlaybookRunPanelSlideout } from "@/components/playbook-run-panel-slideout";

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
  businessId: string;
  categoryId: string | null;
  ownerId: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  resolutionNote: string;
  resolvedAt: string | null;
  escalated: boolean;
  escalationNote: string;
  escalatedToOrg: boolean;
  escalatedToOrgNote: string;
  currentEscalationLevel: number;
  escalationHistory: { level: number; action: string; note: string; at: string }[];
  suggestedAction: string;
  rating: number | null;
  playbookRun?: PlaybookRunSummary | null;
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

export default function CasesClient({ tooltips }: { tooltips: Record<string, string> }) {
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"full" | "limited" | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [expandedCommentsFor, setExpandedCommentsFor] = useState<string | null>(null);
  const [commentsByItem, setCommentsByItem] = useState<Record<string, CommentRow[]>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [escalating, setEscalating] = useState<string | null>(null);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [escalationNoteDraft, setEscalationNoteDraft] = useState("");
  const [filter, setFilter] = useState<"all" | "unassigned" | "overdue" | "resolved" | "escalated">("all");
  const [regionFilter, setRegionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [expandedDescriptionFor, setExpandedDescriptionFor] = useState<string | null>(null);
  const [openRunFor, setOpenRunFor] = useState<{ itemId: string; runId: string } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [filter, regionFilter, categoryFilter, search]);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/group/action-board").then((r) => r.json()),
      fetch("/api/group/businesses").then((r) => r.json()),
      fetch("/api/group/team").then((r) => r.json()),
      fetch("/api/group/category-owners").then((r) => r.json()).catch(() => ({ categories: [] })),
    ]).then(([itemsData, businessesData, teamData, categoryData]) => {
      setItems(itemsData.items ?? []);
      setTier(itemsData.tier ?? null);
      setStats(itemsData.stats ?? null);
      setBusinesses(businessesData.businesses ?? []);
      setTeam(teamData.team ?? []);
      setCategories(categoryData.categories ?? []);
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  function categoryName(id: string | null): string {
    if (!id) return "Any category";
    return categories.find((c) => c._id === id)?.name ?? "Uncategorized";
  }

  function logDecision(ctx: { title: string; trigger: string; linkedCaseId: string }) {
    const params = new URLSearchParams({ new: "1", title: ctx.title, trigger: ctx.trigger, linkedCaseId: ctx.linkedCaseId });
    setOpenRunFor(null);
    router.push(`/group/decision-log?${params.toString()}`);
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

  function startEscalate(id: string) {
    setEscalatingId(id);
    setEscalationNoteDraft("");
  }

  async function confirmEscalate(id: string) {
    setEscalating(id);
    await updateItem(id, { escalated: true, escalationNote: escalationNoteDraft.trim() });
    setEscalating(null);
    setEscalatingId(null);
    setEscalationNoteDraft("");
  }

  async function unEscalate(item: ItemRow) {
    setEscalating(item._id);
    await updateItem(item._id, { escalated: false });
    setEscalating(null);
  }

  async function escalateToNextLevel(id: string) {
    setEscalating(id);
    const res = await fetch(`/api/group/action-board/${id}/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "" }),
    });
    const data = await res.json().catch(() => null);
    setEscalating(null);
    if (!res.ok) {
      alert(data?.message ?? "Failed to escalate");
      return;
    }
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

  const openCount = stats?.open ?? items.filter((i) => i.status === "open").length;
  const inProgressCount = stats?.inProgress ?? items.filter((i) => i.status === "in_progress").length;
  const overdueCount = stats?.overdue ?? items.filter(isOverdue).length;
  const escalatedCount = stats?.escalated ?? items.filter((i) => i.escalated).length;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const resolved30dCount =
    stats?.resolved30d ??
    items.filter((i) => i.status === "resolved" && i.resolvedAt && new Date(i.resolvedAt).getTime() >= thirtyDaysAgo).length;

  const visibleItems = items.filter((item) => {
    if (regionFilter) {
      const region = businesses.find((b) => b._id === item.businessId)?.region;
      if (region !== regionFilter) return false;
    }
    if (categoryFilter && item.categoryId !== categoryFilter) return false;
    if (filter === "unassigned") return !item.ownerId;
    if (filter === "overdue") return isOverdue(item);
    if (filter === "resolved") return item.status === "resolved";
    if (filter === "escalated") return item.escalated;
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
          <h1>
            {isLimited ? "My Cases" : "Case Management"}
            {!isLimited && <InfoTip text={tooltips["oversight"]} />}
          </h1>
          <p className="subtitle">
            {isLimited
              ? "Cases assigned to you — update their status as you work through them."
              : "Read-only oversight of every branch's Case Management — assigning and resolving cases is each branch's own job. Comment on a case or flag it Escalated if it needs your attention."}
          </p>
        </div>
        <div className="page-head-actions">
          <a className="link-action" href="/group/playbooks">
            ⚙ Playbook Library
          </a>
        </div>
      </div>

      {!isLimited && (
        <div className="grid grid-6 kpi-strip" data-tour="cases-kpi-strip" style={{ marginBottom: 20 }}>
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
            <div className="metric-val" style={{ color: "var(--red)" }}>{overdueCount}</div>
          </div>
          <div className="card" style={{ background: "var(--red-bg)" }}>
            <div className="metric-label" style={{ color: "var(--red)" }}>
              Escalated
              <InfoTip text={tooltips["escalated"]} />
            </div>
            <div className="metric-val" style={{ color: "var(--red)" }}>{escalatedCount}</div>
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

      {!isLimited && (
        <div className="filters" data-tour="cases-filters">
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
          {pagedItems.map((item, index) => {
            const overdue = isOverdue(item);
            const run = item.playbookRun ?? null;
            const descriptionExpanded = expandedDescriptionFor === item._id;
            const descriptionIsLong = item.description.length > 160;
            const age = item.status === "resolved" ? null : ageBadge(item);
            const severityClass = item.priority === "critical" ? " sev-critical" : item.priority === "high" ? " sev-high" : "";
            const isFirst = index === 0;
            return (
              <div
                className={`card ab-card${severityClass}${overdue ? " overdue" : ""}`}
                data-tour={isFirst ? "cases-first-card" : undefined}
                key={item._id}
              >
                <div className="ab-card-head">
                  <div className="ab-title-block">
                    <div className="ab-title">{item.title}</div>
                    <div className="ab-meta-row">
                      <Stars rating={item.rating} />
                      {!isLimited && (
                        <span>
                          Business: <b>{businessName(item.businessId)}</b>
                        </span>
                      )}
                      {item.categoryId && (
                        <span className="pill pill-gray">{categoryName(item.categoryId)}</span>
                      )}
                      <span>
                        Due: <b>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"}</b>
                      </span>
                    </div>
                    {item.description && (
                      <>
                        <div className={`ab-desc${descriptionExpanded ? " expanded" : ""}`}>{item.description}</div>
                        {descriptionIsLong && (
                          <span
                            className="ab-show-more"
                            onClick={() => setExpandedDescriptionFor(descriptionExpanded ? null : item._id)}
                          >
                            {descriptionExpanded ? "Show less" : "Show more"}
                          </span>
                        )}
                      </>
                    )}
                    {item.escalated && item.escalationNote && (
                      <div className="ab-callout escalation">
                        <b>Escalation note:</b> {item.escalationNote}
                      </div>
                    )}
                    {item.escalatedToOrg && (
                      <div className="ab-callout escalation">
                        <b>Escalated by the branch:</b> {item.escalatedToOrgNote || "(no note added)"}
                      </div>
                    )}
                    {item.suggestedAction && (
                      <div className="ab-callout">
                        <b>Suggested:</b> {item.suggestedAction}
                      </div>
                    )}
                  </div>
                  <div className="ab-actions-col">
                    <div className="ab-badges">
                      {item.escalated && (
                        <span className="pill pill-red" title={item.escalationNote || undefined}>
                          Escalated
                        </span>
                      )}
                      {item.escalated && <InfoTip text={tooltips["escalated"]} />}
                      {item.escalatedToOrg && (
                        <span className="pill pill-red" title={item.escalatedToOrgNote || undefined}>
                          Escalated by branch
                        </span>
                      )}
                      <span className={`pill ${item.status === "resolved" ? "pill-green" : "pill-amber"}`}>
                        {item.status.replace(/_/g, " ")}
                      </span>
                      {item.currentEscalationLevel > 1 && (
                        <span className="pill pill-amber">Escalation level {item.currentEscalationLevel}</span>
                      )}
                      {age && <span className={`pill ${age.overdue ? "pill-red" : "pill-gray"}`}>{age.label}</span>}
                      <span className={`pill pill-${item.priority === "critical" || item.priority === "high" ? "amber" : "gray"}`}>
                        {item.priority}
                      </span>
                    </div>
                    {isLimited && item.status !== "resolved" && resolvingId !== item._id && (
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
                      <span className="pb-no-playbook">No playbook set</span>
                    ) : null}
                    <button
                      type="button"
                      className={`case-action-btn${expandedCommentsFor === item._id ? " active" : ""}`}
                      onClick={() => toggleComments(item._id)}
                    >
                      💬 Comments{commentsByItem[item._id] ? ` (${commentsByItem[item._id].length})` : ""}
                    </button>
                    {!isLimited && (
                      <button
                        type="button"
                        className={`case-action-btn${item.escalated ? " active" : ""}`}
                        data-tour={isFirst ? "cases-first-escalate" : undefined}
                        disabled={escalating === item._id}
                        onClick={() => (item.escalated ? unEscalate(item) : startEscalate(item._id))}
                      >
                        {item.escalated ? "↩ Un-escalate" : "↗ Escalate"}
                      </button>
                    )}
                    {!isLimited && item.status !== "resolved" && (
                      <button
                        type="button"
                        className="case-action-btn"
                        disabled={escalating === item._id}
                        onClick={() => escalateToNextLevel(item._id)}
                        title="Advance this case to the next configured escalation level"
                      >
                        ↑ Escalate to next level
                      </button>
                    )}
                  </div>
                  <OwnerBadge label={item.ownerId ? ownerLabel(item.ownerId) : null} tip={tooltips["owner"]} />
                </div>

                {escalatingId === item._id && (
                  <div className="ab-panel">
                    <p className="card-sub" style={{ marginTop: 0 }}>
                      Escalating notifies{" "}
                      <b>{item.ownerId ? ownerLabel(item.ownerId) : `${businessName(item.businessId)}'s owner`}</b> by
                      email right now, flagging this item as needing their attention. Add a note so they know why.
                    </p>
                    <div className="field">
                      <label>Note (optional, included in the email)</label>
                      <textarea value={escalationNoteDraft} onChange={(e) => setEscalationNoteDraft(e.target.value)} />
                    </div>
                    <button className="btn btn-dark btn-sm" disabled={escalating === item._id} onClick={() => confirmEscalate(item._id)}>
                      {escalating === item._id ? "Escalating…" : "Send escalation"}
                    </button>{" "}
                    <button className="btn btn-sm" onClick={() => setEscalatingId(null)}>
                      Cancel
                    </button>
                  </div>
                )}

                {expandedCommentsFor === item._id && (
                  <div className="ab-panel">
                    {item.escalationHistory && item.escalationHistory.length > 0 && (
                      <ul style={{ margin: "0 0 10px", paddingLeft: 0, listStyle: "none" }}>
                        {item.escalationHistory.map((h, i) => (
                          <li key={i} style={{ marginBottom: 6, fontSize: "12.5px", color: "var(--text-3)" }}>
                            ↑ Level {h.level} → escalated{h.note ? `: ${h.note}` : ""} — {new Date(h.at).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    )}
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
                )}

                {isLimited && resolvingId === item._id && (
                  <div className="ab-panel">
                    <div className="field" style={{ margin: 0 }}>
                      <label>What did you do about this?</label>
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
          basePath="group"
          categoryName={categoryName}
          onClose={() => setOpenRunFor(null)}
          onChanged={load}
          libraryHref="/group/playbooks"
          onLogDecision={logDecision}
          onResolveCase={
            isLimited
              ? () => {
                  const itemId = openRunFor.itemId;
                  setOpenRunFor(null);
                  startResolve(itemId);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
