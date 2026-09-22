"use client";

import { useEffect, useState } from "react";

interface CategoryRow {
  _id: string;
  name: string;
}
interface MappingRow {
  categoryId: string;
  defaultOwnerId: string;
  repeatThresholdCount: number | null;
  repeatWindowDays: number | null;
}
interface TeamRow {
  userId: string;
  label: string;
}

const INVITE_OPTION = "__invite__";

export default function GroupCategoryOwnersPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingRow>>({});
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [inviteForCategory, setInviteForCategory] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [repeatDrafts, setRepeatDrafts] = useState<Record<string, { count: string; days: string }>>({});
  const [savingRepeatFor, setSavingRepeatFor] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([fetch("/api/group/category-owners").then((r) => r.json()), fetch("/api/group/team").then((r) => r.json())]).then(
      ([data, teamData]) => {
        setCategories(data.categories ?? []);
        const byCategory: Record<string, MappingRow> = {};
        const drafts: Record<string, { count: string; days: string }> = {};
        for (const m of data.mappings ?? []) {
          byCategory[m.categoryId] = m;
          drafts[m.categoryId] = {
            count: m.repeatThresholdCount != null ? String(m.repeatThresholdCount) : "",
            days: m.repeatWindowDays != null ? String(m.repeatWindowDays) : "",
          };
        }
        setMappings(byCategory);
        setRepeatDrafts(drafts);
        setTeam(teamData.team ?? []);
        setLoading(false);
      }
    );
  }

  useEffect(load, []);

  async function setOwner(categoryId: string, defaultOwnerId: string) {
    if (defaultOwnerId === INVITE_OPTION) {
      setInviteForCategory(categoryId);
      setInviteEmail("");
      setInviteError(null);
      return;
    }
    setSavingCategoryId(categoryId);
    if (!defaultOwnerId) {
      await fetch(`/api/group/category-owners?categoryId=${encodeURIComponent(categoryId)}`, { method: "DELETE" });
    } else {
      await fetch("/api/group/category-owners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, defaultOwnerId }),
      });
    }
    setSavingCategoryId(null);
    load();
  }

  async function saveRepeatThreshold(categoryId: string) {
    const ownerId = mappings[categoryId]?.defaultOwnerId;
    if (!ownerId) return;
    const draft = repeatDrafts[categoryId] ?? { count: "", days: "" };
    setSavingRepeatFor(categoryId);
    await fetch("/api/group/category-owners", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        defaultOwnerId: ownerId,
        repeatThresholdCount: draft.count.trim() ? Number(draft.count) : null,
        repeatWindowDays: draft.days.trim() ? Number(draft.days) : null,
      }),
    });
    setSavingRepeatFor(null);
    load();
  }

  async function sendInvite(categoryId: string) {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    const res = await fetch("/api/group/team-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), tier: "full" }),
    });
    const data = await res.json().catch(() => null);
    setInviting(false);
    if (!res.ok) {
      setInviteError(data?.message ?? "Failed to invite");
      return;
    }
    setInviteForCategory(null);
    const newUserId: string | undefined = data?.member?._id;
    if (newUserId) {
      await setOwner(categoryId, newUserId);
    } else {
      load();
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Category Owners</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            When an Alert Rule fires, the AI picks the category — this says who the resulting case goes to.
          </p>
        </div>
      </div>

      <div className="callout" style={{ marginBottom: 12 }}>
        This is the <b>default</b> owner for every branch in your organization. Any branch can set its own owner for a
        category from its own Category Owners page — that overrides your default for that branch only, everyone else
        still falls back to what you set here.
      </div>
      <div className="callout">
        Items in a mapped category are assigned directly to that category&rsquo;s default owner — no separate
        confirmation step.
      </div>
      <div className="callout">
        &quot;Flag as recurring after&quot; is org-wide: it only flags a pattern that spans <b>two or more branches</b>{" "}
        — a repeat within a single branch is that branch&rsquo;s own setting on its Category Owners page. Leave blank
        to turn detection off for that category.
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean" data-tour="cat-owners-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Default owner</th>
              <th>Flag as recurring after</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c, index) => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td data-tour={index === 0 ? "cat-owners-first-select" : undefined}>
                  {inviteForCategory === c._id ? (
                    <div className="field-row" style={{ alignItems: "flex-end" }}>
                      <div className="field" style={{ margin: 0 }}>
                        <input
                          type="email"
                          autoFocus
                          placeholder="new.person@business.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendInvite(c._id)}
                        />
                      </div>
                      <button className="btn btn-sm btn-dark" disabled={inviting || !inviteEmail.trim()} onClick={() => sendInvite(c._id)}>
                        {inviting ? "Inviting…" : "Send invite"}
                      </button>
                      <button className="btn btn-sm" onClick={() => setInviteForCategory(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <select
                      value={mappings[c._id]?.defaultOwnerId ?? ""}
                      disabled={savingCategoryId === c._id}
                      onChange={(e) => setOwner(c._id, e.target.value)}
                    >
                      <option value="">Not set</option>
                      {team.map((t) => (
                        <option key={t.userId} value={t.userId}>
                          {t.label}
                        </option>
                      ))}
                      <option value={INVITE_OPTION}>+ Invite new team member…</option>
                    </select>
                  )}
                  {inviteForCategory === c._id && inviteError && <p className="error-text">{inviteError}</p>}
                </td>
                <td>
                  {mappings[c._id]?.defaultOwnerId ? (
                    <div className="field-row" style={{ alignItems: "flex-end", gap: 6 }}>
                      <div className="field" style={{ margin: 0, width: 70 }}>
                        <label style={{ fontSize: 11 }}>Times</label>
                        <input
                          type="number"
                          min="2"
                          placeholder="off"
                          value={repeatDrafts[c._id]?.count ?? ""}
                          onChange={(e) =>
                            setRepeatDrafts((d) => ({ ...d, [c._id]: { ...(d[c._id] ?? { count: "", days: "" }), count: e.target.value } }))
                          }
                        />
                      </div>
                      <div className="field" style={{ margin: 0, width: 70 }}>
                        <label style={{ fontSize: 11 }}>Days</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="—"
                          value={repeatDrafts[c._id]?.days ?? ""}
                          onChange={(e) =>
                            setRepeatDrafts((d) => ({ ...d, [c._id]: { ...(d[c._id] ?? { count: "", days: "" }), days: e.target.value } }))
                          }
                        />
                      </div>
                      <button
                        className="btn btn-sm"
                        disabled={savingRepeatFor === c._id}
                        onClick={() => saveRepeatThreshold(c._id)}
                      >
                        {savingRepeatFor === c._id ? "…" : "Save"}
                      </button>
                    </div>
                  ) : (
                    <span className="subtitle">Set an owner first</span>
                  )}
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={3} className="subtitle">
                  No categories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
