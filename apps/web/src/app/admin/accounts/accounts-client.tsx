"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InfoTip } from "@/components/info-tip";

type TabId = "businesses" | "orgs" | "staff" | "roles";

interface BusinessRow {
  _id: string;
  name: string;
  industry: string;
  parentOrgId: string | null;
  active: boolean;
  accountManagerId: string | null;
  ownerUserId: string | null;
  ownerInviteStatus: string | null;
}
interface ParentOrgRow {
  _id: string;
  name: string;
  accountManagerId: string | null;
  ownerUserId: string | null;
  ownerInviteStatus: string | null;
}
interface StaffRow {
  _id: string;
  email: string;
  roleId: { _id: string; name: string } | null;
  inviteStatus: string;
}
interface PermissionValue {
  view: boolean;
  edit: boolean;
  delete: boolean;
  scope?: "all" | "assigned";
}
interface RoleRow {
  _id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  peopleCount: number;
  permissions: Record<string, PermissionValue>;
}

const PERMISSION_AREAS: { key: string; label: string; scoped: boolean }[] = [
  { key: "businesses", label: "Businesses", scoped: true },
  { key: "parentOrgs", label: "Parent Organizations", scoped: true },
  { key: "staffAndRoles", label: "Staff & Roles", scoped: false },
  { key: "billingOversight", label: "Billing Oversight", scoped: false },
  { key: "questionTemplates", label: "Question Templates", scoped: false },
  { key: "emailAndSiteContent", label: "Email Templates & Site Content", scoped: false },
  { key: "aiInsightsQueue", label: "AI Insights Queue", scoped: true },
];

function blankPermissions(): Record<string, PermissionValue> {
  const perms: Record<string, PermissionValue> = {};
  for (const area of PERMISSION_AREAS) {
    perms[area.key] = { view: false, edit: false, delete: false, ...(area.scoped ? { scope: "assigned" as const } : {}) };
  }
  return perms;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "businesses", label: "Businesses" },
  { id: "orgs", label: "Parent Organizations" },
  { id: "staff", label: "Staff" },
  { id: "roles", label: "Roles & Permissions" },
];

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "Request failed");
  return data;
}

export default function AccountsClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [tab, setTab] = useState<TabId>("businesses");
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [parentOrgs, setParentOrgs] = useState<ParentOrgRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessSearch, setBusinessSearch] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");

  function loadAll() {
    setLoading(true);
    setError(null);
    return Promise.all([
      fetchJson<{ businesses: BusinessRow[] }>("/api/admin/businesses").then((d) => setBusinesses(d.businesses)),
      fetchJson<{ parentOrgs: ParentOrgRow[] }>("/api/admin/parent-orgs").then((d) => setParentOrgs(d.parentOrgs)),
      fetchJson<{ staff: StaffRow[] }>("/api/admin/staff").then((d) => setStaff(d.staff)),
      fetchJson<{ roles: RoleRow[] }>("/api/admin/roles").then((d) => setRoles(d.roles)),
    ])
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeStaff(id: string) {
    if (!confirm("Remove this staff member's access?")) return;
    const res = await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
    if (res.ok) setStaff((s) => s.filter((row) => row._id !== id));
  }

  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleBusinessActive(business: BusinessRow) {
    setTogglingId(business._id);
    const res = await fetch(`/api/admin/businesses/${business._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !business.active }),
    });
    setTogglingId(null);
    if (res.ok) {
      setBusinesses((rows) => rows.map((r) => (r._id === business._id ? { ...r, active: !r.active } : r)));
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Failed to update business");
    }
  }

  async function removeBusiness(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/businesses/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBusinesses((rows) => rows.filter((row) => row._id !== id));
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Failed to delete business");
    }
  }

  async function removeParentOrg(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/parent-orgs/${id}`, { method: "DELETE" });
    if (res.ok) {
      setParentOrgs((rows) => rows.filter((row) => row._id !== id));
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Failed to delete organization");
    }
  }

  const [resendingId, setResendingId] = useState<string | null>(null);

  async function resendInvite(id: string) {
    setResendingId(id);
    const res = await fetch(`/api/admin/users/${id}/resend-invite`, { method: "POST" });
    setResendingId(null);
    if (res.ok) {
      loadAll();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Failed to resend invite");
    }
  }

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editStaffRoleId, setEditStaffRoleId] = useState("");
  const [editStaffBusinessIds, setEditStaffBusinessIds] = useState<Set<string>>(new Set());
  const [editStaffOrgIds, setEditStaffOrgIds] = useState<Set<string>>(new Set());
  const [savingStaffEdit, setSavingStaffEdit] = useState(false);
  const [staffEditError, setStaffEditError] = useState<string | null>(null);

  function openEditStaffModal(staffRow: StaffRow) {
    setEditingStaffId(staffRow._id);
    setEditStaffRoleId(staffRow.roleId?._id ?? roles[0]?._id ?? "");
    setEditStaffBusinessIds(new Set(businesses.filter((b) => b.accountManagerId === staffRow._id).map((b) => b._id)));
    setEditStaffOrgIds(new Set(parentOrgs.filter((o) => o.accountManagerId === staffRow._id).map((o) => o._id)));
    setStaffEditError(null);
  }

  function closeEditStaffModal() {
    setEditingStaffId(null);
    setStaffEditError(null);
  }

  function toggleEditStaffSet(set: Set<string>, setSet: (next: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  const editStaffRole = roles.find((r) => r._id === editStaffRoleId) ?? null;
  const editStaffBusinessesScoped = editStaffRole?.permissions.businesses?.scope !== "all";
  const editStaffOrgsScoped = editStaffRole?.permissions.parentOrgs?.scope !== "all";

  async function saveStaffEdit() {
    if (!editingStaffId) return;
    setSavingStaffEdit(true);
    setStaffEditError(null);
    const body: Record<string, unknown> = { roleId: editStaffRoleId };
    if (editStaffBusinessesScoped) body.assignedBusinessIds = Array.from(editStaffBusinessIds);
    if (editStaffOrgsScoped) body.assignedParentOrgIds = Array.from(editStaffOrgIds);
    const res = await fetch(`/api/admin/staff/${editingStaffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    setSavingStaffEdit(false);
    if (!res.ok) {
      setStaffEditError(data?.message ?? "Failed to save changes");
      return;
    }
    setEditingStaffId(null);
    loadAll();
  }

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  function openInviteModal() {
    setInviteName("");
    setInviteEmail("");
    setInviteRoleId(roles[0]?._id ?? "");
    setInviteError(null);
    setShowInviteModal(true);
  }

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<Record<string, PermissionValue>>({});
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [showNewRoleModal, setShowNewRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState<Record<string, PermissionValue>>(blankPermissions());
  const [creatingRole, setCreatingRole] = useState(false);

  function startEditRole(role: RoleRow) {
    setEditingRoleId(role._id);
    setEditPermissions(JSON.parse(JSON.stringify(role.permissions)));
    setRoleError(null);
  }

  function cancelEditRole() {
    setEditingRoleId(null);
    setRoleError(null);
  }

  function updatePermCell(
    target: Record<string, PermissionValue>,
    setTarget: (next: Record<string, PermissionValue>) => void,
    area: string,
    field: "view" | "edit" | "delete" | "scope",
    value: boolean | "all" | "assigned"
  ) {
    setTarget({ ...target, [area]: { ...target[area], [field]: value } });
  }

  async function saveRole(roleId: string) {
    setSavingRole(true);
    setRoleError(null);
    const res = await fetch(`/api/admin/roles/${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: editPermissions }),
    });
    const data = await res.json().catch(() => null);
    setSavingRole(false);
    if (!res.ok) {
      setRoleError(data?.message ?? "Failed to save role");
      return;
    }
    setEditingRoleId(null);
    loadAll();
  }

  async function deleteRole(roleId: string, name: string) {
    if (!confirm(`Delete the "${name}" role? Anyone assigned to it will need a new role.`)) return;
    const res = await fetch(`/api/admin/roles/${roleId}`, { method: "DELETE" });
    if (res.ok) {
      loadAll();
    } else {
      const data = await res.json().catch(() => null);
      setRoleError(data?.message ?? "Failed to delete role");
    }
  }

  function openNewRoleModal() {
    setNewRoleName("");
    setNewRoleDescription("");
    setNewRolePermissions(blankPermissions());
    setRoleError(null);
    setShowNewRoleModal(true);
  }

  async function createRole() {
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    setRoleError(null);
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoleName, description: newRoleDescription, permissions: newRolePermissions }),
    });
    const data = await res.json().catch(() => null);
    setCreatingRole(false);
    if (!res.ok) {
      setRoleError(data?.message ?? "Failed to create role");
      return;
    }
    setShowNewRoleModal(false);
    loadAll();
  }

  async function submitInvite() {
    setInviting(true);
    setInviteError(null);
    const res = await fetch("/api/admin/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, name: inviteName, accountType: "admin_staff", roleId: inviteRoleId }),
    });
    const data = await res.json().catch(() => null);
    setInviting(false);
    if (!res.ok) {
      setInviteError(data?.message ?? "Failed to send invite");
      return;
    }
    setShowInviteModal(false);
    const role = roles.find((r) => r._id === inviteRoleId) ?? null;
    setStaff((s) => [
      ...s,
      {
        _id: data.userId,
        email: inviteEmail,
        roleId: role ? { _id: role._id, name: role.name } : null,
        inviteStatus: "invite_pending",
      },
    ]);
  }

  function loginStatusCell(ownerUserId: string | null, ownerInviteStatus: string | null) {
    if (!ownerUserId) return <span className="pill pill-red">No login</span>;
    return (
      <span className="row-flex">
        <span className={`pill ${ownerInviteStatus === "active" ? "pill-green" : "pill-amber"}`}>{ownerInviteStatus}</span>
        {ownerInviteStatus !== "active" && (
          <button
            className="btn btn-sm"
            style={{ marginLeft: 8 }}
            disabled={resendingId === ownerUserId}
            onClick={() => resendInvite(ownerUserId)}
          >
            {resendingId === ownerUserId ? "Sending…" : "Resend invite"}
          </button>
        )}
      </span>
    );
  }

  const filteredBusinesses = businesses.filter((b) => b.name.toLowerCase().includes(businessSearch.trim().toLowerCase()));
  const filteredOrgs = parentOrgs.filter((o) => o.name.toLowerCase().includes(orgSearch.trim().toLowerCase()));
  const filteredStaff = staff.filter((s) => s.email.toLowerCase().includes(staffSearch.trim().toLowerCase()));

  const orgNameById = new Map(parentOrgs.map((o) => [o._id, o.name]));
  const businessCountByOrgId = new Map<string, number>();
  for (const b of businesses) {
    if (!b.parentOrgId) continue;
    businessCountByOrgId.set(b.parentOrgId, (businessCountByOrgId.get(b.parentOrgId) ?? 0) + 1);
  }
  function assignedAccountsCell(staffRow: StaffRow) {
    const role = staffRow.roleId ? roles.find((r) => r._id === staffRow.roleId!._id) : null;
    const scopeAll =
      role?.permissions.businesses?.scope === "all" || role?.permissions.parentOrgs?.scope === "all";
    if (scopeAll) return "All";
    const count =
      businesses.filter((b) => b.accountManagerId === staffRow._id).length +
      parentOrgs.filter((o) => o.accountManagerId === staffRow._id).length;
    return count;
  }

  const cta =
    tab === "businesses" ? (
      <Link className="btn btn-dark" href="/admin/businesses/new">
        + New Business
      </Link>
    ) : tab === "orgs" ? (
      <Link className="btn btn-dark" href="/admin/parent-orgs/new">
        + New Parent Organization
      </Link>
    ) : tab === "staff" ? (
      <button className="btn btn-dark" onClick={openInviteModal}>
        + Invite Staff
      </button>
    ) : null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            Accounts
            <InfoTip text={tooltips["accounts"]} />
          </h1>
          <p className="subtitle">Every business, parent organization, and staff member — and who's allowed to see what.</p>
        </div>
        {cta}
      </div>

      <div className="subtabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="subtitle">Loading…</p>}

      {!loading && tab === "businesses" && (
        <>
        <div className="filters">
          <input
            type="text"
            placeholder="Search businesses…"
            value={businessSearch}
            onChange={(e) => setBusinessSearch(e.target.value)}
          />
        </div>
        <table className="clean">
          <thead>
            <tr>
              <th>Name</th>
              <th>Industry</th>
              <th>Parent Org</th>
              <th>
                Login
                <InfoTip text={tooltips["login-status"]} />
              </th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBusinesses.map((b) => (
              <tr key={b._id}>
                <td>{b.name}</td>
                <td>
                  <span className="pill pill-gray">{b.industry || "—"}</span>
                </td>
                <td>
                  {b.parentOrgId ? (
                    <Link href={`/admin/parent-orgs/${b.parentOrgId}`}>{orgNameById.get(b.parentOrgId) ?? "—"}</Link>
                  ) : (
                    <span className="pill pill-gray">Standalone</span>
                  )}
                </td>
                <td>{loginStatusCell(b.ownerUserId, b.ownerInviteStatus)}</td>
                <td>
                  <button
                    type="button"
                    className={`toggle ${b.active ? "on" : ""}`}
                    disabled={togglingId === b._id}
                    title={b.active ? "Deactivate" : "Activate"}
                    onClick={() => toggleBusinessActive(b)}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link className="btn btn-sm" style={{ marginRight: 8 }} href={`/admin/businesses/${b._id}`}>
                    Manage →
                  </Link>
                  <button className="icon-btn btn-danger" onClick={() => removeBusiness(b._id, b.name)}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {filteredBusinesses.length === 0 && (
              <tr>
                <td colSpan={6} className="subtitle">
                  {businesses.length === 0 ? "No businesses yet." : "No businesses match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </>
      )}

      {!loading && tab === "orgs" && (
        <>
        <div className="filters">
          <input
            type="text"
            placeholder="Search organizations…"
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
          />
        </div>
        <table className="clean">
          <thead>
            <tr>
              <th>Name</th>
              <th>Businesses</th>
              <th>
                Login
                <InfoTip text={tooltips["login-status"]} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrgs.map((o) => (
              <tr key={o._id}>
                <td>{o.name}</td>
                <td>
                  <span className="pill pill-gray">{businessCountByOrgId.get(o._id) ?? 0}</span>
                </td>
                <td>{loginStatusCell(o.ownerUserId, o.ownerInviteStatus)}</td>
                <td style={{ textAlign: "right" }}>
                  <Link className="btn btn-sm" style={{ marginRight: 8 }} href={`/admin/parent-orgs/${o._id}`}>
                    Manage →
                  </Link>
                  <button className="icon-btn btn-danger" onClick={() => removeParentOrg(o._id, o.name)}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {filteredOrgs.length === 0 && (
              <tr>
                <td colSpan={4} className="subtitle">
                  {parentOrgs.length === 0 ? "No parent organizations yet." : "No organizations match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </>
      )}

      {!loading && tab === "staff" && (
        <>
        <div className="filters">
          <input
            type="text"
            placeholder="Search staff…"
            value={staffSearch}
            onChange={(e) => setStaffSearch(e.target.value)}
          />
        </div>
        <table className="clean">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Assigned accounts</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((s) => (
              <tr key={s._id}>
                <td>
                  <div className="row-flex">
                    <div className="avatar">{s.email.slice(0, 2).toUpperCase()}</div>
                    {s.email}
                  </div>
                </td>
                <td>
                  <span className="pill pill-blue">{s.roleId?.name ?? "—"}</span>{" "}
                  <span style={{ fontSize: 12, color: "var(--accent)", cursor: "pointer" }} onClick={() => setTab("roles")}>
                    what can they see? →
                  </span>
                </td>
                <td>{assignedAccountsCell(s)}</td>
                <td>
                  <span className={`pill ${s.inviteStatus === "active" ? "pill-green" : "pill-amber"}`}>{s.inviteStatus}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  {s.inviteStatus !== "active" && (
                    <button
                      className="btn btn-sm"
                      style={{ marginRight: 8 }}
                      disabled={resendingId === s._id}
                      onClick={() => resendInvite(s._id)}
                    >
                      {resendingId === s._id ? "Sending…" : "Resend invite"}
                    </button>
                  )}
                  <button className="icon-btn" style={{ marginRight: 8 }} title="Edit role & access" onClick={() => openEditStaffModal(s)}>
                    ✎
                  </button>
                  <button className="icon-btn btn-danger" onClick={() => removeStaff(s._id)}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {filteredStaff.length === 0 && (
              <tr>
                <td colSpan={5} className="subtitle">
                  {staff.length === 0 ? "No staff yet." : "No staff match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </>
      )}

      {!loading && tab === "roles" && (
        <div>
          <div className="page-head">
            <p className="section-sub" style={{ margin: 0 }}>
              This is where a role's access is actually defined.
            </p>
            <button className="btn btn-dark" onClick={openNewRoleModal}>
              + New role
            </button>
          </div>
          {roleError && <p className="error-text">{roleError}</p>}
          {roles.map((role) => {
            const isEditing = editingRoleId === role._id;
            const perms = isEditing ? editPermissions : role.permissions;
            return (
              <div className="role-card" key={role._id}>
                <div className="page-head" style={{ marginBottom: 0 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>
                      {role.name} <span className="pill pill-purple" style={{ marginLeft: 6 }}>{role.peopleCount} people</span>
                    </h3>
                    <p className="card-sub" style={{ margin: "2px 0 0" }}>
                      {role.description}
                    </p>
                  </div>
                  <div className="btn-group">
                    {isEditing ? (
                      <>
                        <button className="btn btn-sm" onClick={cancelEditRole} disabled={savingRole}>
                          Cancel
                        </button>
                        <button className="btn btn-dark btn-sm" onClick={() => saveRole(role._id)} disabled={savingRole}>
                          {savingRole ? "Saving…" : "Save"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-sm" onClick={() => startEditRole(role)}>
                          Edit permissions
                        </button>
                        {!role.isSystemRole && (
                          <button className="icon-btn btn-danger" onClick={() => deleteRole(role._id, role.name)}>
                            🗑
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <table className="perm-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Area</th>
                      <th>View</th>
                      <th>Edit</th>
                      <th>Delete</th>
                      <th>Scope</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_AREAS.map((area) => {
                      const perm = perms[area.key] ?? { view: false, edit: false, delete: false };
                      return (
                        <tr key={area.key}>
                          <td>{area.label}</td>
                          {(["view", "edit", "delete"] as const).map((field) => (
                            <td key={field} style={{ textAlign: "center" }}>
                              {isEditing ? (
                                <input
                                  type="checkbox"
                                  checked={perm[field]}
                                  onChange={(e) => updatePermCell(editPermissions, setEditPermissions, area.key, field, e.target.checked)}
                                />
                              ) : perm[field] ? (
                                "✓"
                              ) : (
                                "—"
                              )}
                            </td>
                          ))}
                          <td style={{ textAlign: "center" }}>
                            {!area.scoped ? (
                              "—"
                            ) : isEditing ? (
                              <select
                                value={perm.scope ?? "assigned"}
                                onChange={(e) =>
                                  updatePermCell(editPermissions, setEditPermissions, area.key, "scope", e.target.value as "all" | "assigned")
                                }
                              >
                                <option value="assigned">Assigned</option>
                                <option value="all">All</option>
                              </select>
                            ) : (
                              perm.scope ?? "assigned"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {showNewRoleModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowNewRoleModal(false)}>
          <div className="modal-box" style={{ maxWidth: 640 }}>
            <div className="modal-head">
              <h2>New role</h2>
              <button className="modal-close" onClick={() => setShowNewRoleModal(false)}>
                ×
              </button>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Name</label>
                <input type="text" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
              </div>
              <div className="field">
                <label>Description</label>
                <input type="text" value={newRoleDescription} onChange={(e) => setNewRoleDescription(e.target.value)} />
              </div>
            </div>
            <table className="perm-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Area</th>
                  <th>View</th>
                  <th>Edit</th>
                  <th>Delete</th>
                  <th>Scope</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_AREAS.map((area) => {
                  const perm = newRolePermissions[area.key];
                  return (
                    <tr key={area.key}>
                      <td>{area.label}</td>
                      {(["view", "edit", "delete"] as const).map((field) => (
                        <td key={field} style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={perm[field]}
                            onChange={(e) =>
                              updatePermCell(newRolePermissions, setNewRolePermissions, area.key, field, e.target.checked)
                            }
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: "center" }}>
                        {!area.scoped ? (
                          "—"
                        ) : (
                          <select
                            value={perm.scope ?? "assigned"}
                            onChange={(e) =>
                              updatePermCell(newRolePermissions, setNewRolePermissions, area.key, "scope", e.target.value as "all" | "assigned")
                            }
                          >
                            <option value="assigned">Assigned</option>
                            <option value="all">All</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {roleError && <p className="error-text">{roleError}</p>}
            <button className="btn btn-dark" disabled={creatingRole} onClick={createRole} style={{ marginTop: 12 }}>
              {creatingRole ? "Creating…" : "+ Create role"}
            </button>
          </div>
        </div>
      )}

      {editingStaffId && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeEditStaffModal()}>
          <div className="modal-box">
            <div className="modal-head">
              <h2>Edit staff access</h2>
              <button className="modal-close" onClick={closeEditStaffModal}>
                ×
              </button>
            </div>
            <div className="field">
              <label>Role</label>
              <select value={editStaffRoleId} onChange={(e) => setEditStaffRoleId(e.target.value)}>
                {roles.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Assigned businesses</label>
              {!editStaffBusinessesScoped ? (
                <p className="subtitle" style={{ margin: 0 }}>
                  This role has access to all businesses — nothing to assign.
                </p>
              ) : (
                <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--border, #e2e2df)", borderRadius: 6, padding: 8 }}>
                  {businesses.map((b) => (
                    <label key={b._id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                      <input
                        type="checkbox"
                        checked={editStaffBusinessIds.has(b._id)}
                        onChange={() => toggleEditStaffSet(editStaffBusinessIds, setEditStaffBusinessIds, b._id)}
                      />
                      {b.name}
                    </label>
                  ))}
                  {businesses.length === 0 && <p className="subtitle" style={{ margin: 0 }}>No businesses yet.</p>}
                </div>
              )}
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Assigned parent organizations</label>
              {!editStaffOrgsScoped ? (
                <p className="subtitle" style={{ margin: 0 }}>
                  This role has access to all parent organizations — nothing to assign.
                </p>
              ) : (
                <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--border, #e2e2df)", borderRadius: 6, padding: 8 }}>
                  {parentOrgs.map((o) => (
                    <label key={o._id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                      <input
                        type="checkbox"
                        checked={editStaffOrgIds.has(o._id)}
                        onChange={() => toggleEditStaffSet(editStaffOrgIds, setEditStaffOrgIds, o._id)}
                      />
                      {o.name}
                    </label>
                  ))}
                  {parentOrgs.length === 0 && <p className="subtitle" style={{ margin: 0 }}>No parent organizations yet.</p>}
                </div>
              )}
            </div>

            {staffEditError && <p className="error-text">{staffEditError}</p>}
            <div className="modal-actions">
              <button className="btn" onClick={closeEditStaffModal}>
                Cancel
              </button>
              <button className="btn btn-dark" disabled={savingStaffEdit || !editStaffRoleId} onClick={saveStaffEdit}>
                {savingStaffEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowInviteModal(false)}>
          <div className="modal-box">
            <div className="modal-head">
              <h2>Invite staff</h2>
              <button className="modal-close" onClick={() => setShowInviteModal(false)}>
                ×
              </button>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Name</label>
                <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Role</label>
              <select value={inviteRoleId} onChange={(e) => setInviteRoleId(e.target.value)}>
                {roles.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            {inviteError && <p className="error-text">{inviteError}</p>}
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowInviteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-dark" disabled={inviting || !inviteEmail || !inviteRoleId} onClick={submitInvite}>
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
