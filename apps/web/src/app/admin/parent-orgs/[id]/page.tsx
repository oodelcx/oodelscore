"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type TabId = "general" | "address" | "contact" | "businesses";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "address", label: "Address & Billing" },
  { id: "contact", label: "Contact" },
  { id: "businesses", label: "Businesses & Billing" },
];

interface FormState {
  name: string;
  defaultBillingMode: string;
  address: { street: string; city: string; postcode: string };
  billingAddressSameAsAddress: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  branchSeatLimit: string; // "" = unlimited
  teamMemberSeatLimit: string; // "" = unlimited
  compEnabled: boolean;
  compPeriod: string;
  compCustomExpiresAt: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  defaultBillingMode: "branch_pays",
  address: { street: "", city: "", postcode: "" },
  billingAddressSameAsAddress: true,
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  branchSeatLimit: "",
  teamMemberSeatLimit: "",
  compEnabled: false,
  compPeriod: "30_days",
  compCustomExpiresAt: "",
};

const COMP_PERIOD_LABELS: Record<string, string> = {
  "15_days": "15 days",
  "30_days": "30 days",
  "60_days": "60 days",
  unlimited: "Unlimited",
  custom: "Custom date",
};

interface BusinessRow {
  _id: string;
  name: string;
  industry: string;
  billingAssignment: string;
}

export default function ParentOrgDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === "new";

  const [tab, setTab] = useState<TabId>("general");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    status: string;
    isComp: boolean;
    compPeriod: string | null;
    compExpiresAt: string | null;
    plan: string;
    mrrValue: number;
    stripeCustomerId: string;
  } | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [editingCompPeriod, setEditingCompPeriod] = useState(false);
  const [compPeriodDraft, setCompPeriodDraft] = useState("30_days");
  const [compCustomDraft, setCompCustomDraft] = useState("");

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    fetch(`/api/admin/parent-orgs/${params.id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        const o = d.parentOrg;
        setForm({
          ...EMPTY_FORM,
          name: o.name ?? "",
          defaultBillingMode: o.defaultBillingMode ?? "branch_pays",
          address: o.address ?? EMPTY_FORM.address,
          billingAddressSameAsAddress: o.billingAddressSameAsAddress ?? true,
          contactName: o.contactName ?? "",
          contactEmail: o.contactEmail ?? "",
          contactPhone: o.contactPhone ?? "",
          branchSeatLimit: o.branchSeatLimit != null ? String(o.branchSeatLimit) : "",
          teamMemberSeatLimit: o.teamMemberSeatLimit != null ? String(o.teamMemberSeatLimit) : "",
        });
        setBusinesses(d.businesses ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [isNew, params.id]);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/admin/parent-orgs/${params.id}/billing`)
      .then((r) => r.json())
      .then((d) => setSubscription(d.subscription ?? null));
  }, [isNew, params.id]);

  async function startCheckout(plan: "business_monthly" | "business_yearly") {
    setBillingBusy(true);
    setBillingError(null);
    const res = await fetch(`/api/admin/parent-orgs/${params.id}/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json().catch(() => null);
    setBillingBusy(false);
    if (!res.ok) {
      setBillingError(data?.message ?? "Failed to start checkout");
      return;
    }
    window.location.href = data.url;
  }

  function startMarkComp() {
    setCompPeriodDraft(subscription?.compPeriod ?? "30_days");
    setCompCustomDraft(subscription?.compExpiresAt ? subscription.compExpiresAt.slice(0, 10) : "");
    setEditingCompPeriod(true);
  }

  async function confirmMarkComp() {
    if (compPeriodDraft === "custom" && !compCustomDraft) {
      setBillingError("Pick a custom expiry date.");
      return;
    }
    setBillingBusy(true);
    setBillingError(null);
    const res = await fetch(`/api/admin/parent-orgs/${params.id}/billing/comp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: compPeriodDraft, customExpiresAt: compCustomDraft || undefined }),
    });
    const data = await res.json().catch(() => null);
    setBillingBusy(false);
    if (!res.ok) {
      setBillingError(data?.message ?? "Failed to mark comp");
      return;
    }
    setSubscription(data.subscription);
    setEditingCompPeriod(false);
  }

  async function openBillingPortal() {
    setBillingBusy(true);
    setBillingError(null);
    const res = await fetch(`/api/admin/parent-orgs/${params.id}/billing/portal`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBillingBusy(false);
    if (!res.ok) {
      setBillingError(data?.message ?? "Failed to open billing portal");
      return;
    }
    window.location.href = data.url;
  }

  async function handleSave() {
    if (isNew && !form.name.trim()) {
      setTab("general");
      setError("Organization name is required.");
      return;
    }
    if (isNew && !form.contactEmail.trim()) {
      setTab("contact");
      setError("Contact email is required — it becomes this organization's login.");
      return;
    }

    setSaving(true);
    setError(null);

    const body = {
      name: form.name,
      defaultBillingMode: form.defaultBillingMode,
      address: form.address,
      billingAddressSameAsAddress: form.billingAddressSameAsAddress,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      branchSeatLimit: form.branchSeatLimit.trim() ? Number(form.branchSeatLimit) : null,
      teamMemberSeatLimit: form.teamMemberSeatLimit.trim() ? Number(form.teamMemberSeatLimit) : null,
      ...(isNew && form.compEnabled
        ? { compPeriod: form.compPeriod, compCustomExpiresAt: form.compCustomExpiresAt || undefined }
        : {}),
    };

    const res = await fetch(isNew ? "/api/admin/parent-orgs" : `/api/admin/parent-orgs/${params.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      setError(data?.message ?? "Save failed");
      return;
    }

    if (isNew) {
      if (data.ownerInviteError) {
        alert(`Organization created, but its login couldn't be created: ${data.ownerInviteError}`);
      }
      if (data.compError) {
        alert(`Organization created, but the comp account couldn't be set: ${data.compError}`);
      }
      router.push(`/admin/parent-orgs/${data.parentOrg._id}`);
    }
  }

  async function updateBusinessBilling(businessId: string, billingAssignment: string) {
    const res = await fetch(`/api/admin/businesses/${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingAssignment }),
    });
    if (res.ok) {
      setBusinesses((bs) => bs.map((b) => (b._id === businessId ? { ...b, billingAssignment } : b)));
    }
  }

  if (loading) return <p className="subtitle">Loading…</p>;

  return (
    <div>
      <Link className="backlink" href="/admin/accounts">
        ← Back to Accounts
      </Link>
      <div className="page-head">
        <div>
          <h1>{isNew ? "New organization" : form.name || "Parent organization"}</h1>
          <p className="subtitle">{isNew ? "Not yet created" : `${businesses.length} business(es)`}</p>
        </div>
      </div>

      {isNew && (
        <div className="callout">
          Creating a new Parent Organization. Fill in <b>General</b> and <b>Contact</b> (the contact email becomes its
          login) before clicking <b>Create organization</b> — Businesses &amp; Billing unlocks once it exists.
        </div>
      )}

      <div className="subtabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            disabled={isNew && t.id === "businesses"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {tab === "general" && (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="field">
            <label>Organization name</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="field">
            <label>Default billing mode</label>
            <select
              value={form.defaultBillingMode}
              onChange={(e) => setForm((f) => ({ ...f, defaultBillingMode: e.target.value }))}
            >
              <option value="branch_pays">Branch pays (each business pays its own)</option>
              <option value="group_pays">Group pays (one invoice covers every business)</option>
            </select>
            <div className="field-hint">
              Just the default for new businesses added later — override any individual one on the Businesses &amp;
              Billing tab.
            </div>
          </div>
          {!isNew && (
            <div className="field-row">
              <div className="field">
                <label>Branch seat limit</label>
                <input
                  type="number"
                  min={0}
                  placeholder="Unlimited"
                  value={form.branchSeatLimit}
                  onChange={(e) => setForm((f) => ({ ...f, branchSeatLimit: e.target.value }))}
                />
                <div className="field-hint">Blank = unlimited. Enforced against currently-active branches.</div>
              </div>
              <div className="field">
                <label>Group&rsquo;s own team seat limit</label>
                <input
                  type="number"
                  min={0}
                  placeholder="Unlimited"
                  value={form.teamMemberSeatLimit}
                  onChange={(e) => setForm((f) => ({ ...f, teamMemberSeatLimit: e.target.value }))}
                />
                <div className="field-hint">Independent of any branch&rsquo;s own team seat limit.</div>
              </div>
            </div>
          )}
          {isNew && <div className="section-label">Comp account</div>}
          {isNew && (
            <div className="field">
              <div className="field-check">
                <input
                  type="checkbox"
                  id="org-comp-enabled"
                  checked={form.compEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, compEnabled: e.target.checked }))}
                />
                <label htmlFor="org-comp-enabled" style={{ margin: 0 }}>
                  Make this a comp account (no Stripe charge)
                </label>
              </div>
              {form.compEnabled && (
                <div className="field-row" style={{ marginTop: 8 }}>
                  <div className="field">
                    <label>Comp period</label>
                    <select
                      value={form.compPeriod}
                      onChange={(e) => setForm((f) => ({ ...f, compPeriod: e.target.value }))}
                    >
                      {Object.entries(COMP_PERIOD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.compPeriod === "custom" && (
                    <div className="field">
                      <label>Expires on</label>
                      <input
                        type="date"
                        value={form.compCustomExpiresAt}
                        onChange={(e) => setForm((f) => ({ ...f, compCustomExpiresAt: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <button className="btn btn-dark" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : isNew ? "Create organization" : "Save"}
          </button>
        </div>
      )}

      {tab === "address" && (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="field">
            <input
              type="text"
              placeholder="Street address"
              value={form.address.street}
              onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, street: e.target.value } }))}
            />
          </div>
          <div className="field-row">
            <input
              type="text"
              placeholder="Town / City"
              value={form.address.city}
              onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, city: e.target.value } }))}
            />
            <input
              type="text"
              placeholder="Postcode"
              value={form.address.postcode}
              onChange={(e) => setForm((f) => ({ ...f, address: { ...f.address, postcode: e.target.value } }))}
            />
          </div>
          <div className="field-check">
            <input
              type="checkbox"
              checked={form.billingAddressSameAsAddress}
              onChange={(e) => setForm((f) => ({ ...f, billingAddressSameAsAddress: e.target.checked }))}
            />
            Billing address same as above
          </div>
          <button className="btn btn-dark" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : isNew ? "Create organization" : "Save"}
          </button>
        </div>
      )}

      {tab === "address" && !isNew && (
        <div className="card" style={{ maxWidth: 640, marginTop: 16 }}>
          <h3>Subscription</h3>
          {billingError && <p className="error-text">{billingError}</p>}
          {subscription ? (
            <>
              <p className="card-sub">
                {subscription.isComp ? (
                  <>
                    <span className="pill pill-purple">Comp</span>{" "}
                    {subscription.compExpiresAt
                      ? `until ${new Date(subscription.compExpiresAt).toLocaleDateString()}`
                      : "— unlimited"}
                  </>
                ) : (
                  <>
                    <span className="pill pill-green">{subscription.status}</span> — {subscription.plan} — $
                    {subscription.mrrValue.toFixed(2)}/mo
                  </>
                )}
              </p>
              {subscription.stripeCustomerId && (
                <button className="btn" disabled={billingBusy} onClick={openBillingPortal} style={{ marginRight: 8 }}>
                  Manage in Stripe
                </button>
              )}
              {subscription.isComp && !editingCompPeriod && (
                <button className="btn btn-sm" disabled={billingBusy} onClick={startMarkComp}>
                  Edit comp period
                </button>
              )}
            </>
          ) : (
            <>
              <p className="card-sub">No subscription yet. This covers every business under this org billed "group_pays."</p>
              <div className="btn-group">
                <button className="btn btn-dark" disabled={billingBusy} onClick={() => startCheckout("business_monthly")}>
                  Start monthly checkout
                </button>
                <button className="btn btn-dark" disabled={billingBusy} onClick={() => startCheckout("business_yearly")}>
                  Start yearly checkout
                </button>
                <button className="btn" disabled={billingBusy} onClick={startMarkComp}>
                  Mark as Comp
                </button>
              </div>
            </>
          )}
          {editingCompPeriod && (
            <div className="field-row" style={{ marginTop: 10, alignItems: "flex-end" }}>
              <div className="field">
                <label>Comp period</label>
                <select value={compPeriodDraft} onChange={(e) => setCompPeriodDraft(e.target.value)}>
                  {Object.entries(COMP_PERIOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {compPeriodDraft === "custom" && (
                <div className="field">
                  <label>Expires on</label>
                  <input type="date" value={compCustomDraft} onChange={(e) => setCompCustomDraft(e.target.value)} />
                </div>
              )}
              <button className="btn btn-dark btn-sm" disabled={billingBusy} onClick={confirmMarkComp}>
                {billingBusy ? "Saving…" : "Confirm"}
              </button>
              <button className="btn btn-sm" disabled={billingBusy} onClick={() => setEditingCompPeriod(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "contact" && (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="field">
            <label>Contact name</label>
            <input type="text" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Contact email {isNew && <span style={{ color: "crimson" }}>*</span>}</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              />
              {isNew && <p className="field-hint">This becomes the organization&apos;s login — required to create it.</p>}
            </div>
            <div className="field">
              <label>Contact phone</label>
              <input
                type="text"
                value={form.contactPhone}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              />
            </div>
          </div>
          <button className="btn btn-dark" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : isNew ? "Create organization" : "Save"}
          </button>
        </div>
      )}

      {tab === "businesses" && !isNew && (
        <div>
          <div className="page-head">
            <h3 style={{ margin: 0 }}>Businesses in this organization</h3>
            <Link className="btn" href={`/admin/businesses/new?parentOrgId=${params.id}`}>
              + Add business to this org
            </Link>
          </div>
          <table className="clean">
            <thead>
              <tr>
                <th>Name</th>
                <th>Industry</th>
                <th>Billed to</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => (
                <tr key={b._id}>
                  <td>{b.name}</td>
                  <td>{b.industry || "—"}</td>
                  <td>
                    <select value={b.billingAssignment} onChange={(e) => updateBusinessBilling(b._id, e.target.value)}>
                      <option value="unassigned">Unassigned</option>
                      <option value="branch_pays">Branch pays</option>
                      <option value="group_pays">Group pays</option>
                    </select>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn btn-sm" href={`/admin/businesses/${b._id}`}>
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
              {businesses.length === 0 && (
                <tr>
                  <td colSpan={4} className="subtitle">
                    No businesses in this organization yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
