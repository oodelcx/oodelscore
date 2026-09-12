"use client";

import { useEffect, useState } from "react";

interface CategoryRow {
  _id: string;
  name: string;
}
interface MappingRow {
  categoryId: string;
  defaultOwnerId: string;
  autoAssignWithoutConfirmation: boolean;
}
interface TeamRow {
  userId: string;
  label: string;
}

export default function GroupCategoryOwnersPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingRow>>({});
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoAssign, setAutoAssign] = useState(false);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([fetch("/api/group/category-owners").then((r) => r.json()), fetch("/api/group/team").then((r) => r.json())]).then(
      ([data, teamData]) => {
        setCategories(data.categories ?? []);
        const byCategory: Record<string, MappingRow> = {};
        for (const m of data.mappings ?? []) byCategory[m.categoryId] = m;
        setMappings(byCategory);
        setAutoAssign(Object.values(byCategory).some((m) => m.autoAssignWithoutConfirmation));
        setTeam(teamData.team ?? []);
        setLoading(false);
      }
    );
  }

  useEffect(load, []);

  async function setOwner(categoryId: string, defaultOwnerId: string) {
    if (!defaultOwnerId) return;
    setSavingCategoryId(categoryId);
    await fetch("/api/group/category-owners", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, defaultOwnerId }),
    });
    setSavingCategoryId(null);
    load();
  }

  async function toggleAutoAssign(value: boolean) {
    setAutoAssign(value);
    await fetch("/api/group/category-owners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoAssignWithoutConfirmation: value }),
    });
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Category Owners</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            When an Alert Rule fires, the AI picks the category — this says who the resulting Action Board item goes to.
          </p>
        </div>
      </div>

      <div className="callout" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>
          <b>Auto-assign without confirmation.</b> Off by default — new items are suggestions the mapped owner must
          Accept. Turn on once you trust these mappings.
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={autoAssign} onChange={(e) => toggleAutoAssign(e.target.checked)} />
          Enabled
        </label>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Category</th>
              <th>Default owner</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td>
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
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={2} className="subtitle">
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
