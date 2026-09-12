"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TabId = "businesses" | "orgs" | "staff" | "roles";

interface BusinessRow {
  _id: string;
  name: string;
  industry: string;
  parentOrgId: string | null;
  active: boolean;
  ownerUserId: string | null;
  ownerInviteStatus: string | null;
}
interface ParentOrgRow {
  _id: string;
  name: string;
  ownerUserId: string | null;
  ownerInviteStatus: string | null;
}
interface StaffRow {
  _id: string;
  email: string;
  roleId: { _id: string; name: string } | null;
  inviteStatus: string;
}
interface RoleRow {
  _id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  peopleCount: number;
  permissions: Record<string, { view: boolean; edit: boolean; delete: boolean }>;
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

export default function AccountsPage() {
  const [tab, setTab] = useState<TabId>("businesses");
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [parentOrgs, setParentOrgs] = useState<ParentOrgRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          <h1>Accounts</h1>
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
        <table className="clean">
          <thead>
            <tr>
              <th>Name</th>
              <th>Industry</th>
              <th>Active</th>
              <th>Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b._id}>
                <td>{b.name}</td>
                <td>
                  <span className="pill pill-gray">{b.industry || "—"}</span>
                </td>
                <td>
                  <span className={`pill ${b.active ? "pill-green" : "pill-gray"}`}>{b.active ? "Active" : "Inactive"}</span>
                </td>
                <td>{loginStatusCell(b.ownerUserId, b.ownerInviteStatus)}</td>
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
            {businesses.length === 0 && (
              <tr>
                <td colSpan={5} className="subtitle">
                  No businesses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {!loading && tab === "orgs" && (
        <table className="clean">
          <thead>
            <tr>
              <th>Name</th>
              <th>Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {parentOrgs.map((o) => (
              <tr key={o._id}>
                <td>{o.name}</td>
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
            {parentOrgs.length === 0 && (
              <tr>
                <td colSpan={3} className="subtitle">
                  No parent organizations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {!loading && tab === "staff" && (
        <table className="clean">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s._id}>
                <td>
                  <div className="row-flex">
                    <div className="avatar">{s.email.slice(0, 2).toUpperCase()}</div>
                    {s.email}
                  </div>
                </td>
                <td>
                  <span className="pill pill-blue">{s.roleId?.name ?? "—"}</span>
                </td>
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
                  <button className="icon-btn btn-danger" onClick={() => removeStaff(s._id)}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={4} className="subtitle">
                  No staff yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {!loading && tab === "roles" && (
        <div>
          <p className="section-sub" style={{ marginTop: 0 }}>
            This is where a role's access is actually defined.
          </p>
          {roles.map((role) => (
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
              </div>
              <table className="perm-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Area</th>
                    <th>View</th>
                    <th>Edit</th>
                    <th>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(role.permissions).map(([area, perm]) => (
                    <tr key={area}>
                      <td>{area}</td>
                      <td>{perm.view ? "✓" : "—"}</td>
                      <td>{perm.edit ? "✓" : "—"}</td>
                      <td>{perm.delete ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
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
