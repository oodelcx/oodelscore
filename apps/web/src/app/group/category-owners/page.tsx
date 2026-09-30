"use client";

import { useEffect, useState } from "react";

interface CategoryRow {
  _id: string;
  name: string;
  product?: "customer_experience" | "colleague_experience";
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
interface BranchPermissions {
  feedbackPoints: boolean;
  categoryOwners: boolean;
  cxGoals: boolean;
  alertRules: boolean;
}
const BRANCH_PERMISSION_LABELS: Record<keyof BranchPermissions, { label: string; description: string }> = {
  feedbackPoints: { label: "Feedback Points", description: "A branch can view its own feedback points and request changes from Admin." },
  categoryOwners: { label: "Category Owners", description: "A branch can override your default category-owner mapping for its own local staff." },
  cxGoals: { label: "CX Goals", description: "A branch can set its own CX goals, independent of yours." },
  alertRules: { label: "Alert Rules", description: "A branch can add its own alert rules, on top of the ones you cascade down to it." },
};

export default function GroupCategoryOwnersPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingRow>>({});
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [repeatDrafts, setRepeatDrafts] = useState<Record<string, { count: string; days: string }>>({});
  const [savingRepeatFor, setSavingRepeatFor] = useState<string | null>(null);
  const [branchPerms, setBranchPerms] = useState<BranchPermissions | null>(null);
  const [savingPerm, setSavingPerm] = useState<keyof BranchPermissions | null>(null);

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
    fetch("/api/group/branch-permissions")
      .then((r) => r.json())
      .then((d) => setBranchPerms(d.branchPermissions ?? null));
  }

  useEffect(load, []);

  async function toggleBranchPermission(key: keyof BranchPermissions, value: boolean) {
    setSavingPerm(key);
    const res = await fetch("/api/group/branch-permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    const data = await res.json().catch(() => null);
    setSavingPerm(null);
    if (res.ok) setBranchPerms(data.branchPermissions ?? null);
  }

  async function setOwner(categoryId: string, defaultOwnerId: string) {
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

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Branch permissions</h3>
        <p className="card-sub" style={{ margin: "0 0 12px" }}>
          Decide whether your branches manage each of these themselves, or you keep them centralized. Turning one
          off doesn&rsquo;t delete anything a branch already set up — it just hides self-service and stops new
          changes, and everything falls back to what you set for the org.
        </p>
        {branchPerms === null && <p className="subtitle">Loading…</p>}
        {branchPerms !== null && (
          <div style={{ display: "grid", gap: 10 }}>
            {(Object.keys(BRANCH_PERMISSION_LABELS) as (keyof BranchPermissions)[]).map((key) => (
              <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={branchPerms[key]}
                  disabled={savingPerm === key}
                  onChange={(e) => toggleBranchPermission(key, e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <b>{BRANCH_PERMISSION_LABELS[key].label}</b>
                  <span className="subtitle" style={{ display: "block", margin: 0 }}>
                    {BRANCH_PERMISSION_LABELS[key].description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
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
                <td>
                  {c.name}
                  {/* This list covers every enabled product's categories at once (an org-wide
                      mapping, not scoped to whichever tab is active) — the badge is what keeps a
                      Customer Experience category from reading as unlabeled next to a Colleague
                      Experience one. */}
                  {c.product && (
                    <span className={`pill ${c.product === "colleague_experience" ? "pill-blue" : ""}`} style={{ marginLeft: 8, fontSize: 10.5 }}>
                      {c.product === "colleague_experience" ? "Colleague" : "Customer"}
                    </span>
                  )}
                </td>
                <td data-tour={index === 0 ? "cat-owners-first-select" : undefined}>
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
                  </select>
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
