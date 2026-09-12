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
}
interface ParentOrgRow {
  _id: string;
  name: string;
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

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchJson<{ businesses: BusinessRow[] }>("/api/admin/businesses").then((d) => setBusinesses(d.businesses)),
      fetchJson<{ parentOrgs: ParentOrgRow[] }>("/api/admin/parent-orgs").then((d) => setParentOrgs(d.parentOrgs)),
      fetchJson<{ staff: StaffRow[] }>("/api/admin/staff").then((d) => setStaff(d.staff)),
      fetchJson<{ roles: RoleRow[] }>("/api/admin/roles").then((d) => setRoles(d.roles)),
    ])
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function removeStaff(id: string) {
    if (!confirm("Remove this staff member's access?")) return;
    const res = await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
    if (res.ok) setStaff((s) => s.filter((row) => row._id !== id));
  }

  const [resendingId, setResendingId] = useState<string | null>(null);

  async function resendInvite(id: string) {
    setResendingId(id);
    const res = await fetch(`/api/admin/users/${id}/resend-invite`, { method: "POST" });
    setResendingId(null);
    if (res.ok) {
      setStaff((s) => s.map((row) => (row._id === id ? { ...row, inviteStatus: "invite_pending" } : row)));
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Failed to resend invite");
    }
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
                <td>
                  <Link className="btn btn-sm" href={`/admin/businesses/${b._id}`}>
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={4} className="subtitle">
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {parentOrgs.map((o) => (
              <tr key={o._id}>
                <td>{o.name}</td>
                <td>
                  <Link className="btn btn-sm" href={`/admin/parent-orgs/${o._id}`}>
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {parentOrgs.length === 0 && (
              <tr>
                <td colSpan={2} className="subtitle">
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
    </div>
  );
}
