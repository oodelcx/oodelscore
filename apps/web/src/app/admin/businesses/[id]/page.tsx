"use client";

import { Fragment, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { QrModal } from "@/components/qr-modal";

type TabId = "general" | "address" | "contact" | "settings" | "feedback-points" | "group";

const BASE_TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "address", label: "Address & Billing" },
  { id: "contact", label: "Contact" },
  { id: "settings", label: "Settings" },
  { id: "feedback-points", label: "Feedback Points" },
];

const DEMOGRAPHIC_FIELDS = ["name", "email", "phone", "ageGroup", "gender"] as const;

interface FormState {
  name: string;
  industry: string;
  parentOrgId: string;
  active: boolean;
  address: { street: string; city: string; postcode: string };
  billingAddressSameAsAddress: boolean;
  billingAssignment: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  questionTemplateId: string;
  maxFeedbackPoints: string;
  teamMemberSeatLimit: string;
  demographicConfig: Record<string, string>;
  accountManagerId: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  industry: "",
  parentOrgId: "",
  active: true,
  address: { street: "", city: "", postcode: "" },
  billingAddressSameAsAddress: true,
  billingAssignment: "unassigned",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  questionTemplateId: "",
  maxFeedbackPoints: "",
  teamMemberSeatLimit: "",
  demographicConfig: { name: "off", email: "off", phone: "off", ageGroup: "off", gender: "off" },
  accountManagerId: "",
};

export default function BusinessDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = params.id === "new";
  const presetParentOrgId = searchParams.get("parentOrgId");

  const [tab, setTab] = useState<TabId>("general");
  const [form, setForm] = useState<FormState>(
    presetParentOrgId ? { ...EMPTY_FORM, parentOrgId: presetParentOrgId } : EMPTY_FORM
  );
  const [industries, setIndustries] = useState<{ _id: string; name: string }[]>([]);
  const [parentOrgs, setParentOrgs] = useState<{ _id: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<{ _id: string; name: string }[]>([]);
  const [staff, setStaff] = useState<{ _id: string; email: string }[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [subscription, setSubscription] = useState<{
    status: string;
    isComp: boolean;
    plan: string;
    mrrValue: number;
    stripeCustomerId: string;
  } | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  interface FeedbackPointRow {
    _id: string;
    name: string;
    description: string;
    qrToken: string;
    scans: number;
    active: boolean;
    formLayoutOverride: string | null;
    questionTemplateOverride: string | null;
    demographicOverride: Record<string, string> | null;
  }
  const [feedbackPoints, setFeedbackPoints] = useState<FeedbackPointRow[]>([]);
  const [fpName, setFpName] = useState("");
  const [fpDescription, setFpDescription] = useState("");
  const [fpCreating, setFpCreating] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);
  const [qrPoint, setQrPoint] = useState<FeedbackPointRow | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [expandedFieldsId, setExpandedFieldsId] = useState<string | null>(null);

  function loadFeedbackPoints() {
    if (isNew) return;
    fetch(`/api/admin/businesses/${params.id}/feedback-points`)
      .then((r) => r.json())
      .then((d) => setFeedbackPoints(d.feedbackPoints ?? []));
  }

  useEffect(() => {
    loadFeedbackPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, params.id]);

  async function createFeedbackPoint() {
    if (!fpName.trim()) return;
    setFpCreating(true);
    setFpError(null);
    const res = await fetch(`/api/admin/businesses/${params.id}/feedback-points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fpName, description: fpDescription }),
    });
    const data = await res.json().catch(() => null);
    setFpCreating(false);
    if (!res.ok) {
      setFpError(data?.message ?? "Failed to create feedback point");
      return;
    }
    setFpName("");
    setFpDescription("");
    loadFeedbackPoints();
    if (data?.feedbackPoint) setQrPoint(data.feedbackPoint);
  }

  async function toggleFeedbackPointActive(fp: FeedbackPointRow) {
    await fetch(`/api/admin/businesses/${params.id}/feedback-points/${fp._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !fp.active }),
    });
    loadFeedbackPoints();
  }

  async function updateFeedbackPointLayout(fpId: string, formLayoutOverride: string) {
    await fetch(`/api/admin/businesses/${params.id}/feedback-points/${fpId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formLayoutOverride }),
    });
    loadFeedbackPoints();
  }

  async function updateFeedbackPointTemplate(fpId: string, questionTemplateOverride: string) {
    await fetch(`/api/admin/businesses/${params.id}/feedback-points/${fpId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionTemplateOverride: questionTemplateOverride || null }),
    });
    loadFeedbackPoints();
  }

  async function updateFeedbackPointDemographic(fpId: string, field: string, value: string, current: Record<string, string> | null) {
    const base = current ?? { name: "off", email: "optional", phone: "off", ageGroup: "optional", gender: "optional" };
    await fetch(`/api/admin/businesses/${params.id}/feedback-points/${fpId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demographicOverride: { ...base, [field]: value } }),
    });
    loadFeedbackPoints();
  }

  async function clearFeedbackPointDemographicOverride(fpId: string) {
    await fetch(`/api/admin/businesses/${params.id}/feedback-points/${fpId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demographicOverride: null }),
    });
    loadFeedbackPoints();
  }

  async function regenerateFeedbackPointQr(fp: FeedbackPointRow) {
    if (
      !confirm(
        `Regenerate the QR code for ${fp.name}? The old code stops working immediately — any printed posters using it will show an error.`
      )
    )
      return;
    setRegeneratingId(fp._id);
    const res = await fetch(`/api/admin/businesses/${params.id}/feedback-points/${fp._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateQr: true }),
    });
    const data = await res.json().catch(() => null);
    setRegeneratingId(null);
    loadFeedbackPoints();
    if (res.ok && data?.feedbackPoint) setQrPoint(data.feedbackPoint);
  }

  async function removeFeedbackPoint(fpId: string) {
    if (!confirm("Delete this feedback point? Its QR link will stop working.")) return;
    await fetch(`/api/admin/businesses/${params.id}/feedback-points/${fpId}`, { method: "DELETE" });
    loadFeedbackPoints();
  }

  async function deleteBusiness() {
    if (isNew) return;
    if (
      !confirm(
        `Permanently delete ${form.name || "this business"}? This deletes all its feedback points, responses, and insight history. This cannot be undone.`
      )
    )
      return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/admin/businesses/${params.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Failed to delete business");
      return;
    }
    router.push("/admin/accounts");
  }

  useEffect(() => {
    fetch("/api/admin/industries")
      .then((r) => r.json())
      .then((d) => setIndustries(d.industries ?? []));
    fetch("/api/admin/parent-orgs")
      .then((r) => r.json())
      .then((d) => setParentOrgs(d.parentOrgs ?? []));
    fetch("/api/admin/question-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []));
    fetch("/api/admin/staff")
      .then((r) => r.json())
      .then((d) => setStaff(d.staff ?? []))
      .catch(() => setStaff([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    fetch(`/api/admin/businesses/${params.id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        const b = d.business;
        setForm({
          name: b.name ?? "",
          industry: b.industry ?? "",
          parentOrgId: b.parentOrgId ?? "",
          active: b.active ?? true,
          address: b.address ?? EMPTY_FORM.address,
          billingAddressSameAsAddress: b.billingAddressSameAsAddress ?? true,
          billingAssignment: b.billingAssignment ?? "unassigned",
          contactName: b.contactName ?? "",
          contactEmail: b.contactEmail ?? "",
          contactPhone: b.contactPhone ?? "",
          questionTemplateId: b.questionTemplateId ?? "",
          maxFeedbackPoints: b.maxFeedbackPoints != null ? String(b.maxFeedbackPoints) : "",
          teamMemberSeatLimit: b.teamMemberSeatLimit != null ? String(b.teamMemberSeatLimit) : "",
          demographicConfig: b.demographicConfig ?? EMPTY_FORM.demographicConfig,
          accountManagerId: b.accountManagerId ?? "",
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [isNew, params.id]);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/admin/businesses/${params.id}/billing`)
      .then((r) => r.json())
      .then((d) => setSubscription(d.subscription ?? null));
  }, [isNew, params.id]);

  async function startCheckout(plan: "business_monthly" | "business_yearly") {
    setBillingBusy(true);
    setBillingError(null);
    const res = await fetch(`/api/admin/businesses/${params.id}/billing/checkout`, {
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

  async function markComp() {
    setBillingBusy(true);
    setBillingError(null);
    const res = await fetch(`/api/admin/businesses/${params.id}/billing/comp`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBillingBusy(false);
    if (!res.ok) {
      setBillingError(data?.message ?? "Failed to mark comp");
      return;
    }
    setSubscription(data.subscription);
  }

  async function openBillingPortal() {
    setBillingBusy(true);
    setBillingError(null);
    const res = await fetch(`/api/admin/businesses/${params.id}/billing/portal`, { method: "POST" });
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
      setError("Business name is required.");
      return;
    }
    if (isNew && !form.contactEmail.trim()) {
      setTab("contact");
      setError("Contact email is required — it becomes this business's login.");
      return;
    }

    setSaving(true);
    setError(null);

    const body = {
      name: form.name,
      industry: form.industry,
      parentOrgId: form.parentOrgId || null,
      active: form.active,
      address: form.address,
      billingAddressSameAsAddress: form.billingAddressSameAsAddress,
      billingAssignment: form.billingAssignment,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      questionTemplateId: form.questionTemplateId || null,
      maxFeedbackPoints: form.maxFeedbackPoints ? Number(form.maxFeedbackPoints) : 1,
      teamMemberSeatLimit: form.teamMemberSeatLimit.trim() ? Number(form.teamMemberSeatLimit) : null,
      demographicConfig: form.demographicConfig,
      accountManagerId: form.accountManagerId || null,
    };

    const res = await fetch(isNew ? "/api/admin/businesses" : `/api/admin/businesses/${params.id}`, {
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
        alert(`Business created, but its login couldn't be created: ${data.ownerInviteError}`);
      }
      router.push(`/admin/businesses/${data.business._id}`);
    }
  }

  function updateDemographic(field: string, value: string) {
    setForm((f) => ({ ...f, demographicConfig: { ...f.demographicConfig, [field]: value } }));
  }

  if (loading) return <p className="subtitle">Loading…</p>;

  const parentOrgName = parentOrgs.find((o) => o._id === form.parentOrgId)?.name ?? null;
  const tabs = form.parentOrgId
    ? [...BASE_TABS, { id: "group" as TabId, label: "Group" }]
    : BASE_TABS;

  return (
    <div>
      <Link className="backlink" href="/admin/accounts">
        ← Back to Accounts
      </Link>
      <div className="page-head">
        <div>
          <h1>{isNew ? "New business" : form.name || "Business"}</h1>
          <p className="subtitle">{isNew ? "Not yet created" : form.active ? "Active" : "Inactive"}</p>
        </div>
      </div>

      {isNew && (
        <div className="callout">
          Creating a new business. Fill in <b>General</b> and <b>Contact</b> (the contact email becomes its login)
          before clicking <b>Create business</b>.
        </div>
      )}

      <div className="subtabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            disabled={isNew && (t.id === "feedback-points" || t.id === "group")}
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
            <label>Business name</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="field">
            <label>Industry</label>
            <select value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}>
              <option value="">—</option>
              {industries.map((i) => (
                <option key={i._id} value={i.name}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Parent Organization (optional)</label>
            <select value={form.parentOrgId} onChange={(e) => setForm((f) => ({ ...f, parentOrgId: e.target.value }))}>
              <option value="">Standalone</option>
              {parentOrgs.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div
            className="field"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <span style={{ fontSize: 13 }}>Account active</span>
            <button
              type="button"
              className={`toggle ${form.active ? "on" : ""}`}
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
            />
          </div>
          <button className="btn btn-dark" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : isNew ? "Create business" : "Save"}
          </button>
        </div>
      )}

      {tab === "address" && (
        <div className="card" style={{ maxWidth: 640 }}>
          <h3>Address</h3>
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
          {form.parentOrgId ? (
            <div className="callout">
              Billing assignment is managed on the{" "}
              <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setTab("group")}>
                {parentOrgName ?? "parent organization"}
              </span>{" "}
              page, alongside every other business in the org.
            </div>
          ) : (
            <div className="field">
              <label>Billing assignment (Admin-only)</label>
              <select
                value={form.billingAssignment}
                onChange={(e) => setForm((f) => ({ ...f, billingAssignment: e.target.value }))}
              >
                <option value="unassigned">Unassigned</option>
                <option value="branch_pays">Branch pays</option>
                <option value="group_pays">Group pays</option>
              </select>
              <div className="field-hint">
                Only the Admin system role can change this — a server-side check rejects the write otherwise.
              </div>
            </div>
          )}
          <button className="btn btn-dark" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : isNew ? "Create business" : "Save"}
          </button>
        </div>
      )}

      {tab === "address" && !isNew && form.billingAssignment === "branch_pays" && (
        <div className="card" style={{ maxWidth: 640, marginTop: 16 }}>
          <h3>Subscription</h3>
          {billingError && <p className="error-text">{billingError}</p>}
          {subscription ? (
            <>
              <p className="card-sub">
                {subscription.isComp ? (
                  <span className="pill pill-purple">Comp</span>
                ) : (
                  <>
                    <span className="pill pill-green">{subscription.status}</span> — {subscription.plan} — $
                    {subscription.mrrValue.toFixed(2)}/mo
                  </>
                )}
              </p>
              {subscription.stripeCustomerId && (
                <button className="btn" disabled={billingBusy} onClick={openBillingPortal}>
                  Manage in Stripe
                </button>
              )}
            </>
          ) : (
            <>
              <p className="card-sub">No subscription yet.</p>
              <div className="btn-group">
                <button className="btn btn-dark" disabled={billingBusy} onClick={() => startCheckout("business_monthly")}>
                  Start monthly checkout
                </button>
                <button className="btn btn-dark" disabled={billingBusy} onClick={() => startCheckout("business_yearly")}>
                  Start yearly checkout
                </button>
                <button className="btn" disabled={billingBusy} onClick={markComp}>
                  Mark as Comp
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "address" && !isNew && form.billingAssignment === "group_pays" && (
        <div className="card" style={{ maxWidth: 640, marginTop: 16 }}>
          <h3>Subscription</h3>
          <p className="card-sub">
            This business is billed via its parent organization — manage its subscription from the org's own detail page.
          </p>
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
              {isNew && <p className="field-hint">This becomes the business&apos;s login — required to create it.</p>}
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
            {saving ? "Saving…" : isNew ? "Create business" : "Save"}
          </button>
        </div>
      )}

      {tab === "group" && form.parentOrgId && (
        <div className="card" style={{ maxWidth: 640 }}>
          <h3>{parentOrgName ?? "Parent organization"}</h3>
          <p className="card-sub">This business belongs to a Parent Organization.</p>
          <div className="field">
            <label>Billing assignment (Admin-only)</label>
            <select
              value={form.billingAssignment}
              onChange={(e) => setForm((f) => ({ ...f, billingAssignment: e.target.value }))}
            >
              <option value="unassigned">Unassigned</option>
              <option value="branch_pays">Branch pays</option>
              <option value="group_pays">Group pays</option>
            </select>
          </div>
          <button className="btn btn-dark" disabled={saving} onClick={handleSave} style={{ marginRight: 8 }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <Link className="btn" href={`/admin/parent-orgs/${form.parentOrgId}`}>
            View {parentOrgName ?? "organization"} →
          </Link>
        </div>
      )}

      {tab === "settings" && (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="field-row">
            <div className="field">
              <label>Question template (Admin-only)</label>
              <select
                value={form.questionTemplateId}
                onChange={(e) => setForm((f) => ({ ...f, questionTemplateId: e.target.value }))}
              >
                <option value="">None</option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Max feedback points (QR limit)</label>
              <input
                type="text"
                placeholder="No limit"
                value={form.maxFeedbackPoints}
                onChange={(e) => setForm((f) => ({ ...f, maxFeedbackPoints: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Team seat limit</label>
              <input
                type="text"
                placeholder="Unlimited"
                value={form.teamMemberSeatLimit}
                onChange={(e) => setForm((f) => ({ ...f, teamMemberSeatLimit: e.target.value }))}
              />
              <div className="field-hint">Blank = unlimited. Enforced against currently-active team members.</div>
            </div>
          </div>
          <div className="field" style={{ maxWidth: 340 }}>
            <label>Assigned staff (account manager)</label>
            <select
              value={form.accountManagerId}
              onChange={(e) => setForm((f) => ({ ...f, accountManagerId: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.email}
                </option>
              ))}
            </select>
            <div className="field-hint">Controls which "assigned"-scoped staff (e.g. Account managers) can see this business.</div>
          </div>
          <div className="section-label">Respondent fields (Admin-only)</div>
          <div className="field-row">
            {DEMOGRAPHIC_FIELDS.slice(0, 3).map((field) => (
              <div className="field" key={field}>
                <label>{field}</label>
                <select value={form.demographicConfig[field]} onChange={(e) => updateDemographic(field, e.target.value)}>
                  <option value="off">Off</option>
                  <option value="optional">Optional</option>
                  <option value="mandatory">Mandatory</option>
                </select>
              </div>
            ))}
          </div>
          <div className="field-row">
            {DEMOGRAPHIC_FIELDS.slice(3).map((field) => (
              <div className="field" key={field}>
                <label>{field}</label>
                <select value={form.demographicConfig[field]} onChange={(e) => updateDemographic(field, e.target.value)}>
                  <option value="off">Off</option>
                  <option value="optional">Optional</option>
                  <option value="mandatory">Mandatory</option>
                </select>
              </div>
            ))}
          </div>
          <button className="btn btn-dark" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : isNew ? "Create business" : "Save Settings"}
          </button>
        </div>
      )}

      {tab === "settings" && !isNew && (
        <div className="card" style={{ maxWidth: 720, marginTop: 20, borderColor: "#F0C7C7" }}>
          <h3 style={{ color: "var(--red)" }}>Danger zone</h3>
          <p className="card-sub">
            Permanently delete this business, its feedback points, responses, and insights. This cannot be undone — use
            &quot;Account active&quot; on the General tab instead if you just want to disable it.
          </p>
          <button className="btn btn-danger" disabled={deleting} onClick={deleteBusiness}>
            {deleting ? "Deleting…" : "Delete this business"}
          </button>
        </div>
      )}

      {tab === "feedback-points" && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3>New feedback point</h3>
            <div className="field-row">
              <div className="field">
                <label>Name</label>
                <input value={fpName} onChange={(e) => setFpName(e.target.value)} placeholder="e.g. Front counter" />
              </div>
              <div className="field">
                <label>Description</label>
                <input value={fpDescription} onChange={(e) => setFpDescription(e.target.value)} />
              </div>
            </div>
            {fpError && <p className="error-text">{fpError}</p>}
            <button className="btn btn-dark" disabled={fpCreating} onClick={createFeedbackPoint}>
              {fpCreating ? "Creating…" : "+ Create feedback point"}
            </button>
          </div>

          <table className="clean">
            <thead>
              <tr>
                <th>Name</th>
                <th>Scans</th>
                <th>Question template</th>
                <th>Layout</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {feedbackPoints.map((fp) => (
                <Fragment key={fp._id}>
                  <tr>
                    <td>{fp.name}</td>
                    <td>{fp.scans}</td>
                    <td>
                      <select
                        value={fp.questionTemplateOverride ?? ""}
                        onChange={(e) => updateFeedbackPointTemplate(fp._id, e.target.value)}
                      >
                        <option value="">Use business default</option>
                        {templates.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={fp.formLayoutOverride ?? "single_page"}
                        onChange={(e) => updateFeedbackPointLayout(fp._id, e.target.value)}
                      >
                        <option value="single_page">All questions, one screen</option>
                        <option value="one_per_screen">One question per screen</option>
                      </select>
                    </td>
                    <td>
                      <span className={`pill ${fp.active ? "pill-green" : "pill-gray"}`}>{fp.active ? "Active" : "Inactive"}</span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm" style={{ marginRight: 8 }} onClick={() => setQrPoint(fp)}>
                        View QR
                      </button>
                      <button
                        className="icon-btn"
                        style={{ marginRight: 8 }}
                        disabled={regeneratingId === fp._id}
                        title="Regenerate QR"
                        onClick={() => regenerateFeedbackPointQr(fp)}
                      >
                        ↻
                      </button>
                      <button className="btn btn-sm" style={{ marginRight: 8 }} onClick={() => toggleFeedbackPointActive(fp)}>
                        {fp.active ? "Deactivate" : "Activate"}
                      </button>
                      <button className="icon-btn btn-danger" onClick={() => removeFeedbackPoint(fp._id)}>
                        🗑
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ borderBottom: expandedFieldsId === fp._id ? undefined : "none", paddingTop: 0 }}>
                      <span
                        style={{ fontSize: 12.5, color: "var(--accent)", cursor: "pointer" }}
                        onClick={() => setExpandedFieldsId(expandedFieldsId === fp._id ? null : fp._id)}
                      >
                        {expandedFieldsId === fp._id ? "▾" : "▸"} Respondent fields for this QR{" "}
                        {fp.demographicOverride ? "(overridden)" : "(using business default)"}
                      </span>
                      {expandedFieldsId === fp._id && (
                        <div style={{ background: "#FAFAF8", borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
                          <div className="field-row">
                            {DEMOGRAPHIC_FIELDS.map((field) => (
                              <div className="field" key={field}>
                                <label>{field}</label>
                                <select
                                  value={fp.demographicOverride?.[field] ?? form.demographicConfig[field]}
                                  onChange={(e) => updateFeedbackPointDemographic(fp._id, field, e.target.value, fp.demographicOverride)}
                                >
                                  <option value="off">Off</option>
                                  <option value="optional">Optional</option>
                                  <option value="mandatory">Mandatory</option>
                                </select>
                              </div>
                            ))}
                          </div>
                          {fp.demographicOverride && (
                            <button className="btn btn-sm" onClick={() => clearFeedbackPointDemographicOverride(fp._id)}>
                              Revert to business default
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                </Fragment>
              ))}
              {feedbackPoints.length === 0 && (
                <tr>
                  <td colSpan={6} className="subtitle">
                    No feedback points yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {qrPoint && (
        <QrModal
          name={qrPoint.name}
          qrToken={qrPoint.qrToken}
          posterHref={`/print/admin-feedback-point/${qrPoint._id}`}
          onClose={() => setQrPoint(null)}
        />
      )}
    </div>
  );
}
