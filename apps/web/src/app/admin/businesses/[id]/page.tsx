"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type TabId = "general" | "address" | "contact" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "address", label: "Address & Billing" },
  { id: "contact", label: "Contact" },
  { id: "settings", label: "Settings" },
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
  demographicConfig: Record<string, string>;
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
  demographicConfig: { name: "off", email: "off", phone: "off", ageGroup: "off", gender: "off" },
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
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          demographicConfig: b.demographicConfig ?? EMPTY_FORM.demographicConfig,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [isNew, params.id]);

  async function handleSave() {
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
      demographicConfig: form.demographicConfig,
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
      router.push(`/admin/businesses/${data.business._id}`);
    }
  }

  function updateDemographic(field: string, value: string) {
    setForm((f) => ({ ...f, demographicConfig: { ...f.demographicConfig, [field]: value } }));
  }

  if (loading) return <p className="subtitle">Loading…</p>;

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
          Creating a new business. Fill in the General tab, then click <b>Create business</b> below to save it.
        </div>
      )}

      <div className="subtabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
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
          <button className="btn btn-dark" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : isNew ? "Create business" : "Save"}
          </button>
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
              <label>Contact email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              />
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
    </div>
  );
}
