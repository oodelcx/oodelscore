"use client";

import { useEffect, useState } from "react";
import { InfoTip } from "@/components/info-tip";

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

export default function BusinessCategoryOwnersClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingRow>>({});
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [isBranch, setIsBranch] = useState(false);
  // Draft repeat-detection values per category, only committed when "Save"
  // is clicked — separate from `mappings` so typing a digit doesn't
  // immediately fire a save.
  const [repeatDrafts, setRepeatDrafts] = useState<Record<string, { count: string; days: string }>>({});
  const [savingRepeatFor, setSavingRepeatFor] = useState<string | null>(null);
  const [ceEnabled, setCeEnabled] = useState(false);
  const [sensitiveRoutingContactId, setSensitiveRoutingContactId] = useState("");
  const [savingSensitiveContact, setSavingSensitiveContact] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/business/category-owners").then((r) => r.json()),
      fetch("/api/business/team").then((r) => r.json()),
      fetch("/api/business/me").then((r) => r.json()),
    ]).then(([data, teamData, meData]) => {
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
      setIsBranch(!!meData.business?.parentOrgId);
      setCeEnabled(!!data.ceEnabled);
      setSensitiveRoutingContactId(data.sensitiveRoutingContactId ?? "");
      setLoading(false);
    });
  }

  useEffect(load, []);

  async function saveSensitiveRoutingContact(value: string) {
    setSensitiveRoutingContactId(value);
    setSavingSensitiveContact(true);
    await fetch("/api/business/category-owners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensitiveRoutingContactId: value || null }),
    });
    setSavingSensitiveContact(false);
  }

  async function setOwner(categoryId: string, defaultOwnerId: string) {
    setSavingCategoryId(categoryId);
    if (!defaultOwnerId) {
      await fetch(`/api/business/category-owners?categoryId=${encodeURIComponent(categoryId)}`, { method: "DELETE" });
    } else {
      await fetch("/api/business/category-owners", {
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
    if (!ownerId) return; // repeat detection needs an owner set first — same as the API requires
    const draft = repeatDrafts[categoryId] ?? { count: "", days: "" };
    setSavingRepeatFor(categoryId);
    await fetch("/api/business/category-owners", {
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
          <h1>
            Category Owners
            <InfoTip text={tooltips["category-owners"]} />
          </h1>
          <p className="subtitle" style={{ margin: 0 }}>
            When an Alert Rule fires, the AI picks the category — this says who the resulting case goes to.
          </p>
        </div>
      </div>

      {isBranch && (
        <div className="callout" style={{ marginBottom: 12 }}>
          Setting an owner here is specific to this branch and overrides your group&rsquo;s default for that category.
          Leave a category unset here to keep using the group&rsquo;s default owner.
        </div>
      )}
      <div className="callout">
        Items in a mapped category are assigned directly to that category&rsquo;s default owner — no separate
        confirmation step.
      </div>
      <div className="callout">
        &quot;Flag as recurring after&quot; watches this business&rsquo;s own cases only — e.g. 5 times in 30 days.
        Leave blank to turn detection off for that category.
      </div>

      {ceEnabled && (
        <div className="callout" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Sensitive category routing</h3>
          <p className="subtitle" style={{ marginTop: 0 }}>
            A Colleague Experience category marked &quot;Sensitive&quot; (HR/leadership complaints) never goes to that
            category&rsquo;s normal owner — it goes here instead, so a complaint about HR never lands with HR.
          </p>
          <div className="field" style={{ maxWidth: 320 }}>
            <label>Sensitive-category contact</label>
            <select
              value={sensitiveRoutingContactId}
              onChange={(e) => saveSensitiveRoutingContact(e.target.value)}
              disabled={savingSensitiveContact}
            >
              <option value="">Not set</option>
              {team.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean" data-tour="cat-owners-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>
                Default owner
                <InfoTip text={tooltips["default-owner"]} />
              </th>
              <th>Flag as recurring after</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c, index) => (
              <tr key={c._id}>
                <td>{c.name}</td>
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
