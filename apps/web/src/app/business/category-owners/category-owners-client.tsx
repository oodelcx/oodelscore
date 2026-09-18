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
}
interface TeamRow {
  userId: string;
  label: string;
}

const INVITE_OPTION = "__invite__";

export default function BusinessCategoryOwnersClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingRow>>({});
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [isBranch, setIsBranch] = useState(false);
  const [inviteForCategory, setInviteForCategory] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/business/category-owners").then((r) => r.json()),
      fetch("/api/business/team").then((r) => r.json()),
      fetch("/api/business/me").then((r) => r.json()),
    ]).then(([data, teamData, meData]) => {
      setCategories(data.categories ?? []);
      const byCategory: Record<string, MappingRow> = {};
      for (const m of data.mappings ?? []) byCategory[m.categoryId] = m;
      setMappings(byCategory);
      setTeam(teamData.team ?? []);
      setIsBranch(!!meData.business?.parentOrgId);
      setLoading(false);
    });
  }

  useEffect(load, []);

  async function setOwner(categoryId: string, defaultOwnerId: string) {
    if (defaultOwnerId === INVITE_OPTION) {
      setInviteForCategory(categoryId);
      setInviteEmail("");
      setInviteError(null);
      return;
    }
    if (!defaultOwnerId) return;
    setSavingCategoryId(categoryId);
    await fetch("/api/business/category-owners", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, defaultOwnerId }),
    });
    setSavingCategoryId(null);
    load();
  }

  async function sendInvite(categoryId: string) {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    const res = await fetch("/api/business/team-members", {
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

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Category</th>
              <th>
                Default owner
                <InfoTip text={tooltips["default-owner"]} />
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td>
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
