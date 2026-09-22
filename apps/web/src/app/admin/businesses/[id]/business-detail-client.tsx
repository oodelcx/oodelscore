"use client";

import { Fragment, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { QrModal } from "@/components/qr-modal";
import { PeriodComparisonCards } from "@/components/period-comparison-cards";
import { InfoTip } from "@/components/info-tip";

type TabId = "general" | "performance" | "address" | "contact" | "settings" | "feedback-points" | "group";

// Order matters here — it's the literal left-to-right order Admin sees
// while setting up a new business: identity, then how to reach them, then
// how they pay, then what they'll actually collect feedback on, then the
// rest. Performance comes last since there's nothing to show there until
// the business exists and has real responses.
const BASE_TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "contact", label: "Contact" },
  { id: "address", label: "Address & Billing" },
  { id: "feedback-points", label: "Feedback Points" },
  { id: "settings", label: "Settings" },
  { id: "performance", label: "Performance" },
];

const VALID_TAB_IDS: readonly TabId[] = ["general", "performance", "address", "contact", "settings", "feedback-points", "group"];

const DEMOGRAPHIC_FIELDS = ["name", "email", "phone", "ageGroup", "gender"] as const;

const CX_PULSE_LEVEL_LABELS = ["", "Collecting", "Reacting", "Responding", "Improving", "Embedded"];

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function trendSvgPoints(trend: { date: string; starAverage: number | null }[]): string {
  const values = trend.map((t) => t.starAverage);
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) return "";
  const min = 0;
  const max = 5;
  const width = 360;
  const height = 110;
  const step = width / Math.max(trend.length - 1, 1);
  return trend
    .map((point, i) => {
      const v = point.starAverage ?? known[known.length - 1];
      const y = height - ((v - min) / (max - min)) * height;
      return `${(i * step + 20).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function RatingDonut({ distribution }: { distribution: { highPercent: number; midPercent: number; lowPercent: number } }) {
  const circumference = 2 * Math.PI * 15.9;
  const high = (distribution.highPercent / 100) * circumference;
  const mid = (distribution.midPercent / 100) * circumference;
  const low = (distribution.lowPercent / 100) * circumference;
  return (
    <svg width="120" height="120" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#EAF3DE" strokeWidth="4" />
      <circle
        cx="18"
        cy="18"
        r="15.9"
        fill="none"
        stroke="#639922"
        strokeWidth="4"
        strokeDasharray={`${high} ${circumference - high}`}
        transform="rotate(-90 18 18)"
      />
      <circle
        cx="18"
        cy="18"
        r="15.9"
        fill="none"
        stroke="#EF9F27"
        strokeWidth="4"
        strokeDasharray={`${mid} ${circumference - mid}`}
        strokeDashoffset={-high}
        transform="rotate(-90 18 18)"
      />
      <circle
        cx="18"
        cy="18"
        r="15.9"
        fill="none"
        stroke="#E24B4A"
        strokeWidth="4"
        strokeDasharray={`${low} ${circumference - low}`}
        strokeDashoffset={-(high + mid)}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

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
  compEnabled: boolean;
  compPeriod: string;
  compCustomExpiresAt: string;
  ragThresholds: { starGreenMin: string; starAmberMin: string; npsGreenMin: string; npsAmberMin: string };
  pricingAmount: string;
  pricingCurrency: string;
  pricingInterval: string;
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
  compEnabled: false,
  compPeriod: "30_days",
  compCustomExpiresAt: "",
  ragThresholds: { starGreenMin: "3.7", starAmberMin: "3.0", npsGreenMin: "30", npsAmberMin: "0" },
  pricingAmount: "",
  pricingCurrency: "usd",
  pricingInterval: "",
};

const PRICING_INTERVAL_LABELS: Record<string, string> = {
  monthly: "Monthly",
  annual_monthly_rate: "Annual commitment, billed monthly",
  annual_lump_sum: "Annual, one lump-sum payment",
};

const COMP_PERIOD_LABELS: Record<string, string> = {
  "15_days": "15 days",
  "30_days": "30 days",
  "60_days": "60 days",
  unlimited: "Unlimited",
  custom: "Custom date",
};

export default function BusinessDetailClient({ tooltips }: { tooltips: Record<string, string> }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = params.id === "new";
  const presetParentOrgId = searchParams.get("parentOrgId");
  const requestedTab = searchParams.get("tab");
  const initialTab: TabId = requestedTab && (VALID_TAB_IDS as readonly string[]).includes(requestedTab) ? (requestedTab as TabId) : "general";

  const [tab, setTab] = useState<TabId>(initialTab);
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
    compPeriod: string | null;
    compExpiresAt: string | null;
    plan: string;
    mrrValue: number;
    stripeCustomerId: string;
  } | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [groupPaysCovered, setGroupPaysCovered] = useState(false);
  const [priceSaveMessage, setPriceSaveMessage] = useState<string | null>(null);
  const [editingCompPeriod, setEditingCompPeriod] = useState(false);
  const [compPeriodDraft, setCompPeriodDraft] = useState("30_days");
  const [compCustomDraft, setCompCustomDraft] = useState("");

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

  interface Comparison {
    starAverage: number | null;
    npsScore: number | null;
    responseCount: number;
    changePercent: number | null;
  }
  interface TrendPoint {
    date: string;
    starAverage: number | null;
  }
  interface PerformanceData {
    businessName: string;
    totalResponses: number;
    starAverage: number | null;
    npsScore: number | null;
    comparisons: { week: Comparison; month: Comparison; quarter: Comparison; year: Comparison };
    trend: TrendPoint[];
    distribution: { highPercent: number; midPercent: number; lowPercent: number };
    cxPulseLevel: number | null;
    actionBoard: { openCount: number; overdueCount: number };
  }
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || tab !== "performance" || performance || performanceLoading) return;
    setPerformanceLoading(true);
    setPerformanceError(null);
    fetch(`/api/admin/performance/business/${params.id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load performance");
        return d as PerformanceData;
      })
      .then(setPerformance)
      .catch((err) => setPerformanceError(err instanceof Error ? err.message : "Failed to load performance"))
      .finally(() => setPerformanceLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, tab, params.id]);

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
          ...EMPTY_FORM,
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
          ragThresholds: b.ragThresholds
            ? {
                starGreenMin: String(b.ragThresholds.starGreenMin),
                starAmberMin: String(b.ragThresholds.starAmberMin),
                npsGreenMin: String(b.ragThresholds.npsGreenMin),
                npsAmberMin: String(b.ragThresholds.npsAmberMin),
              }
            : EMPTY_FORM.ragThresholds,
          pricingAmount: b.pricingTerms?.amount != null ? String(b.pricingTerms.amount) : "",
          pricingCurrency: b.pricingTerms?.currency ?? "usd",
          pricingInterval: b.pricingTerms?.interval ?? "",
        });
        setGroupPaysCovered(!!b.groupPaysStripeSubscriptionItemId);
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

  async function startCheckout() {
    setBillingBusy(true);
    setBillingError(null);
    const res = await fetch(`/api/admin/businesses/${params.id}/billing/checkout`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBillingBusy(false);
    if (!res.ok) {
      setBillingError(data?.message ?? "Failed to start checkout");
      return;
    }
    window.location.href = data.url;
  }

  async function savePriceAndPush() {
    setBillingBusy(true);
    setBillingError(null);
    setPriceSaveMessage(null);
    const res = await fetch(`/api/admin/businesses/${params.id}/billing/save-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: form.pricingAmount.trim() ? Number(form.pricingAmount) : null,
        currency: form.pricingCurrency || "usd",
        interval: form.pricingInterval || null,
      }),
    });
    const data = await res.json().catch(() => null);
    setBillingBusy(false);
    if (!res.ok) {
      setBillingError(data?.message ?? "Failed to save price");
      return;
    }
    setPriceSaveMessage(data.message);
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
    const res = await fetch(`/api/admin/businesses/${params.id}/billing/comp`, {
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
      pricingTerms: {
        amount: form.pricingAmount.trim() ? Number(form.pricingAmount) : null,
        currency: form.pricingCurrency || "usd",
        interval: form.pricingInterval || null,
      },
      ...(!isNew && !form.parentOrgId
        ? {
            ragThresholds: {
              starGreenMin: Number(form.ragThresholds.starGreenMin),
              starAmberMin: Number(form.ragThresholds.starAmberMin),
              npsGreenMin: Number(form.ragThresholds.npsGreenMin),
              npsAmberMin: Number(form.ragThresholds.npsAmberMin),
            },
          }
        : {}),
      ...(isNew && form.compEnabled
        ? { compPeriod: form.compPeriod, compCustomExpiresAt: form.compCustomExpiresAt || undefined }
        : {}),
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
      if (data.compError) {
        alert(`Business created, but the comp account couldn't be set: ${data.compError}`);
      }
      router.push(`/admin/businesses/${data.business._id}`);
      return;
    }

    setGroupPaysCovered(!!data.business?.groupPaysStripeSubscriptionItemId);
    if (data.billingSyncWarning) {
      setBillingError(data.billingSyncWarning);
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
            disabled={isNew && (t.id === "feedback-points" || t.id === "group" || t.id === "performance")}
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

      {tab === "performance" && !isNew && (
        <div>
          {performanceLoading && <p className="subtitle">Loading…</p>}
          {performanceError && <p className="error-text">{performanceError}</p>}
          {performance && (
            <>
              <div className="grid grid-4" style={{ marginBottom: 20 }}>
                <div className="card">
                  <div className="metric-label">
                    Total responses
                    <InfoTip text={tooltips["total-responses"]} />
                  </div>
                  <div className="metric-val">{performance.totalResponses}</div>
                </div>
                <div className="card">
                  <div className="metric-label">
                    Average score
                    <InfoTip text={tooltips["average-score"]} />
                  </div>
                  <div className="metric-val">{performance.starAverage !== null ? `${performance.starAverage}/5` : "—"}</div>
                </div>
                <div className="card">
                  <div className="metric-label">
                    NPS
                    <InfoTip text={tooltips["nps"]} />
                  </div>
                  <div className="metric-val">{performance.npsScore !== null ? formatSigned(performance.npsScore) : "—"}</div>
                </div>
                <div className="card">
                  <div className="metric-label">
                    CX Pulse
                    <InfoTip text={tooltips["cx-pulse-level"]} />
                  </div>
                  <div className="metric-val" style={{ fontSize: 18 }}>
                    {performance.cxPulseLevel ? `Level ${performance.cxPulseLevel} · ${CX_PULSE_LEVEL_LABELS[performance.cxPulseLevel]}` : "Not yet scored"}
                  </div>
                </div>
              </div>

              <div className="grid grid-2" style={{ marginBottom: 20 }}>
                <div className="card">
                  <div className="metric-label">Open action items</div>
                  <div className="metric-val">{performance.actionBoard.openCount}</div>
                </div>
                <div className="card" style={{ background: performance.actionBoard.overdueCount > 0 ? "var(--red-bg)" : undefined }}>
                  <div className="metric-label" style={{ color: performance.actionBoard.overdueCount > 0 ? "var(--red)" : undefined }}>
                    Overdue action items
                    <InfoTip text={tooltips["overdue-actions"]} />
                  </div>
                  <div className="metric-val" style={{ color: performance.actionBoard.overdueCount > 0 ? "var(--red)" : undefined }}>
                    {performance.actionBoard.overdueCount}
                  </div>
                </div>
              </div>

              <PeriodComparisonCards comparisons={performance.comparisons} />

              <div className="grid grid-2" style={{ marginTop: 20 }}>
                <div className="card">
                  <h3>
                    Response trend
                    <InfoTip text={tooltips["response-trend"]} />
                  </h3>
                  <p className="card-sub">Daily average score over the last {performance.trend.length} days.</p>
                  <svg viewBox="0 0 400 140" width="100%" height="140">
                    <line x1="30" y1="10" x2="30" y2="120" stroke="#E6E5E1" />
                    <line x1="30" y1="120" x2="390" y2="120" stroke="#E6E5E1" />
                    <text x="8" y="14" fontSize="9" fill="#9A9A97">5</text>
                    <text x="8" y="67" fontSize="9" fill="#9A9A97">2.5</text>
                    <text x="8" y="123" fontSize="9" fill="#9A9A97">0</text>
                    {trendSvgPoints(performance.trend) && (
                      <polyline fill="none" stroke="#0F6E56" strokeWidth="2" points={trendSvgPoints(performance.trend)} />
                    )}
                  </svg>
                </div>
                <div className="card">
                  <h3>
                    Rating distribution
                    <InfoTip text={tooltips["rating-distribution"]} />
                  </h3>
                  <p className="card-sub">Last 30 days.</p>
                  <div className="donut-wrap">
                    <RatingDonut distribution={performance.distribution} />
                    <div className="legend">
                      <div>
                        <span className="dot" style={{ background: "#639922" }}></span>4–5 stars · {performance.distribution.highPercent}%
                      </div>
                      <div>
                        <span className="dot" style={{ background: "#EF9F27" }}></span>3 stars · {performance.distribution.midPercent}%
                      </div>
                      <div>
                        <span className="dot" style={{ background: "#E24B4A" }}></span>1–2 stars · {performance.distribution.lowPercent}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
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
                {form.parentOrgId && <option value="group_pays">Group pays</option>}
              </select>
              <div className="field-hint">
                Only the Admin system role can change this — a server-side check rejects the write otherwise.
              </div>
            </div>
          )}
          <div className="section-label">Red / Amber / Green thresholds</div>
          {form.parentOrgId ? (
            <div className="callout">
              This branch uses{" "}
              <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setTab("group")}>
                {parentOrgName ?? "its parent organization"}
              </span>
              &rsquo;s thresholds — set them on the org page, not per-branch.
            </div>
          ) : isNew ? (
            <p className="field-hint" style={{ marginTop: -4 }}>
              Uses the platform default (3.7 green / 3.0 amber for stars, 30 green / 0 amber for NPS) until you set
              your own after creating this business.
            </p>
          ) : (
            <>
              <p className="field-hint" style={{ marginTop: -6, marginBottom: 12 }}>
                Independent of any other business — this standalone business&rsquo;s own bands.
              </p>
              <div className="field-row">
                <div className="field">
                  <label>Star average — green at or above</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={form.ragThresholds.starGreenMin}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ragThresholds: { ...f.ragThresholds, starGreenMin: e.target.value } }))
                    }
                  />
                </div>
                <div className="field">
                  <label>Star average — amber at or above</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={form.ragThresholds.starAmberMin}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ragThresholds: { ...f.ragThresholds, starAmberMin: e.target.value } }))
                    }
                  />
                  <div className="field-hint">Below this is red.</div>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>NPS — green at or above</label>
                  <input
                    type="number"
                    step="1"
                    min="-100"
                    max="100"
                    value={form.ragThresholds.npsGreenMin}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ragThresholds: { ...f.ragThresholds, npsGreenMin: e.target.value } }))
                    }
                  />
                </div>
                <div className="field">
                  <label>NPS — amber at or above</label>
                  <input
                    type="number"
                    step="1"
                    min="-100"
                    max="100"
                    value={form.ragThresholds.npsAmberMin}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ragThresholds: { ...f.ragThresholds, npsAmberMin: e.target.value } }))
                    }
                  />
                  <div className="field-hint">Below this is red.</div>
                </div>
              </div>
            </>
          )}
          {isNew && !form.parentOrgId && (
            <div className="section-label">Comp account</div>
          )}
          {isNew && !form.parentOrgId && (
            <div className="field">
              <div className="field-check">
                <input
                  type="checkbox"
                  id="comp-enabled"
                  checked={form.compEnabled}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      compEnabled: e.target.checked,
                      billingAssignment: e.target.checked ? "branch_pays" : f.billingAssignment,
                    }))
                  }
                />
                <label htmlFor="comp-enabled" style={{ margin: 0 }}>
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
            {saving ? "Saving…" : isNew ? "Create business" : "Save"}
          </button>
        </div>
      )}

      {tab === "address" && form.billingAssignment !== "group_pays" && (
        <div className="card" style={{ maxWidth: 640, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Pricing</h3>
              <p className="card-sub" style={{ margin: "4px 0 0" }}>
                What this business is actually charged — set here, never in the Stripe Dashboard.
              </p>
            </div>
            {!isNew &&
              (subscription?.isComp ? (
                <span className="pill pill-purple">Comp</span>
              ) : subscription?.status === "active" ? (
                <span className="pill pill-green">Live on Stripe — ${subscription.mrrValue.toFixed(2)}/mo</span>
              ) : (
                <span className="pill pill-gray">Not billing yet</span>
              ))}
          </div>
          <div className="field-row" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 49.00"
                value={form.pricingAmount}
                onChange={(e) => setForm((f) => ({ ...f, pricingAmount: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Currency</label>
              <select value={form.pricingCurrency} onChange={(e) => setForm((f) => ({ ...f, pricingCurrency: e.target.value }))}>
                <option value="usd">USD</option>
                <option value="eur">EUR</option>
                <option value="gbp">GBP</option>
              </select>
            </div>
            <div className="field">
              <label>Billing</label>
              <select value={form.pricingInterval} onChange={(e) => setForm((f) => ({ ...f, pricingInterval: e.target.value }))}>
                <option value="">Not set</option>
                <option value="monthly">Monthly</option>
                <option value="annual_monthly_rate">Annual commitment, billed monthly</option>
                <option value="annual_lump_sum">Annual, one lump-sum payment</option>
              </select>
            </div>
          </div>
          {isNew ? (
            <p className="card-sub" style={{ margin: "0 0 4px" }}>Saved when you create the business.</p>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <button className="btn btn-dark btn-sm" disabled={billingBusy} onClick={savePriceAndPush}>
                {billingBusy ? "Saving…" : "Save & push to Stripe"}
              </button>
              {priceSaveMessage && <span className="card-sub" style={{ margin: 0 }}>{priceSaveMessage}</span>}
            </div>
          )}
        </div>
      )}

      {tab === "address" && !isNew && form.billingAssignment !== "group_pays" && (
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
                    <span className="pill pill-green">{subscription.status}</span> —{" "}
                    {PRICING_INTERVAL_LABELS[subscription.plan] ?? subscription.plan} — ${subscription.mrrValue.toFixed(2)}/mo
                  </>
                )}
              </p>
              {subscription.stripeCustomerId && (
                <button className="btn" disabled={billingBusy} onClick={openBillingPortal} style={{ marginRight: 8 }}>
                  Manage in Stripe
                </button>
              )}
              {subscription.isComp && !editingCompPeriod && (
                <button className="btn btn-sm" disabled={billingBusy} onClick={startMarkComp} style={{ marginRight: 8 }}>
                  Edit comp period
                </button>
              )}
              {subscription.isComp && (
                <button
                  className="btn btn-dark btn-sm"
                  disabled={billingBusy || !form.pricingAmount || !form.pricingInterval}
                  onClick={startCheckout}
                  title={
                    !form.pricingAmount || !form.pricingInterval
                      ? "Set and save a price above first"
                      : "Converts this account off comp once payment completes"
                  }
                >
                  Convert to paying — start checkout
                </button>
              )}
            </>
          ) : (
            <>
              <p className="card-sub">No subscription yet.</p>
              <div className="btn-group">
                <button
                  className="btn btn-dark"
                  disabled={billingBusy || !form.pricingAmount || !form.pricingInterval}
                  onClick={startCheckout}
                  title={!form.pricingAmount || !form.pricingInterval ? "Set and save a price above first" : undefined}
                >
                  Start checkout
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

      {tab === "address" && !isNew && form.billingAssignment === "group_pays" && (
        <div className="card" style={{ maxWidth: 640, marginTop: 16 }}>
          <h3>Subscription</h3>
          <p className="card-sub">
            This business is billed via its parent organization — manage its price from the org's own detail page.
          </p>
          <p className="card-sub">
            {groupPaysCovered ? (
              <span className="pill pill-green">Covered on the org&apos;s Stripe subscription</span>
            ) : (
              <span className="pill pill-amber">Not yet on Stripe — the org needs an active subscription first</span>
            )}
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
