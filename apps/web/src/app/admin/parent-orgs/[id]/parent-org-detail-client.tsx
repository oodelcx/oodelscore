"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PeriodComparisonCards } from "@/components/period-comparison-cards";
import { InfoTip } from "@/components/info-tip";

type TabId = "general" | "performance" | "address" | "contact" | "businesses" | "escalation" | "command-center";

// Same reasoning as the Business detail page: identity, then contact, then
// pricing, then the rest — Performance last since there's nothing to show
// there until the org exists and has real branch data.
const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "contact", label: "Contact" },
  { id: "address", label: "Address & Billing" },
  { id: "businesses", label: "Businesses & Billing" },
  { id: "escalation", label: "Escalation" },
  { id: "command-center", label: "Command Center" },
  { id: "performance", label: "Performance" },
];

const VALID_TAB_IDS: readonly TabId[] = [
  "general",
  "performance",
  "address",
  "contact",
  "businesses",
  "escalation",
  "command-center",
];

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
  commandCenterEnabled: boolean;
  ragThresholds: { starGreenMin: string; starAmberMin: string; npsGreenMin: string; npsAmberMin: string };
  pricingAmount: string;
  pricingCurrency: string;
  pricingInterval: string;
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
  commandCenterEnabled: true,
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

interface BusinessRow {
  _id: string;
  name: string;
  industry: string;
  billingAssignment: string;
}

export default function ParentOrgDetailClient({ tooltips }: { tooltips: Record<string, string> }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = params.id === "new";
  const requestedTab = searchParams.get("tab");
  const initialTab: TabId = requestedTab && (VALID_TAB_IDS as readonly string[]).includes(requestedTab) ? (requestedTab as TabId) : "general";

  const [tab, setTab] = useState<TabId>(initialTab);
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
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [priceSaveMessage, setPriceSaveMessage] = useState<string | null>(null);
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [editingCompPeriod, setEditingCompPeriod] = useState(false);
  const [compPeriodDraft, setCompPeriodDraft] = useState("30_days");
  const [compCustomDraft, setCompCustomDraft] = useState("");

  // Escalation chain — inherited by every branch under this org (same rule
  // as ragThresholds). Level 1 stays fixed at "the branch's own owner."
  const [escalationLevels, setEscalationLevels] = useState<{ level: number; label: string }[]>([{ level: 1, label: "Owner" }]);
  const [escalationSlaHours, setEscalationSlaHours] = useState("");
  const [escalationBusy, setEscalationBusy] = useState(false);
  const [escalationMessage, setEscalationMessage] = useState<string | null>(null);
  const [escalationAssignments, setEscalationAssignments] = useState<
    { _id: string; level: number; region: string; userId: { _id: string; email: string } | null }[]
  >([]);
  const [assignLevel, setAssignLevel] = useState("");
  const [assignRegion, setAssignRegion] = useState("");
  const [assignEmail, setAssignEmail] = useState("");

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
  interface BusinessBreakdownRow {
    businessId: string;
    name: string;
    region: string;
    starAverage: number | null;
    npsScore: number | null;
    responseCount: number;
    weekChangePercent: number | null;
  }
  interface PerformanceData {
    orgName: string;
    totalResponses: number;
    starAverage: number | null;
    npsScore: number | null;
    comparisons: { week: Comparison; month: Comparison; quarter: Comparison; year: Comparison };
    trend: TrendPoint[];
    distribution: { highPercent: number; midPercent: number; lowPercent: number };
    cxPulseLevel: number | null;
    actionBoard: { openCount: number; overdueCount: number };
    businesses: BusinessBreakdownRow[];
  }
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || tab !== "performance" || performance || performanceLoading) return;
    setPerformanceLoading(true);
    setPerformanceError(null);
    fetch(`/api/admin/performance/parent-org/${params.id}`)
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
          commandCenterEnabled: o.commandCenterEnabled ?? true,
          pricingAmount: o.pricingTerms?.amount != null ? String(o.pricingTerms.amount) : "",
          pricingCurrency: o.pricingTerms?.currency ?? "usd",
          pricingInterval: o.pricingTerms?.interval ?? "",
          ragThresholds: o.ragThresholds
            ? {
                starGreenMin: String(o.ragThresholds.starGreenMin),
                starAmberMin: String(o.ragThresholds.starAmberMin),
                npsGreenMin: String(o.ragThresholds.npsGreenMin),
                npsAmberMin: String(o.ragThresholds.npsAmberMin),
              }
            : EMPTY_FORM.ragThresholds,
        });
        setBusinesses(d.businesses ?? []);
        setCheckoutEnabled(!!o.checkoutEnabled);
        setEscalationLevels(o.escalationLevels?.length ? o.escalationLevels : [{ level: 1, label: "Owner" }]);
        setEscalationSlaHours(o.escalationSlaHours != null ? String(o.escalationSlaHours) : "");
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

  function loadEscalationAssignments() {
    fetch(`/api/admin/parent-orgs/${params.id}/escalation-assignments`)
      .then((r) => r.json())
      .then((d) => setEscalationAssignments(d.assignments ?? []));
  }

  useEffect(() => {
    if (isNew) return;
    loadEscalationAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, params.id]);

  function addEscalationLevel() {
    const nextLevel = Math.max(0, ...escalationLevels.map((l) => l.level)) + 1;
    setEscalationLevels((levels) => [...levels, { level: nextLevel, label: "" }]);
  }

  function removeEscalationLevel(level: number) {
    setEscalationLevels((levels) => levels.filter((l) => l.level !== level));
  }

  async function saveEscalationConfig() {
    setEscalationBusy(true);
    setEscalationMessage(null);
    const res = await fetch(`/api/admin/parent-orgs/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        escalationLevels: escalationLevels.filter((l) => l.label.trim()),
        escalationSlaHours: escalationSlaHours.trim() ? Number(escalationSlaHours) : null,
      }),
    });
    const data = await res.json().catch(() => null);
    setEscalationBusy(false);
    if (!res.ok) {
      setEscalationMessage(data?.message ?? "Failed to save escalation config");
      return;
    }
    setEscalationMessage("Saved.");
  }

  async function addEscalationAssignment() {
    if (!assignLevel || !assignEmail.trim()) return;
    setEscalationBusy(true);
    setEscalationMessage(null);
    const res = await fetch(`/api/admin/parent-orgs/${params.id}/escalation-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: Number(assignLevel), region: assignRegion.trim(), email: assignEmail.trim() }),
    });
    const data = await res.json().catch(() => null);
    setEscalationBusy(false);
    if (!res.ok) {
      setEscalationMessage(data?.message ?? "Failed to assign");
      return;
    }
    setAssignEmail("");
    setAssignRegion("");
    loadEscalationAssignments();
  }

  async function removeEscalationAssignment(assignmentId: string) {
    setEscalationBusy(true);
    await fetch(`/api/admin/parent-orgs/${params.id}/escalation-assignments/${assignmentId}`, { method: "DELETE" });
    setEscalationBusy(false);
    loadEscalationAssignments();
  }

  async function startCheckout() {
    setBillingBusy(true);
    setBillingError(null);
    const res = await fetch(`/api/admin/parent-orgs/${params.id}/billing/checkout`, { method: "POST" });
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
    const res = await fetch(`/api/admin/parent-orgs/${params.id}/billing/save-price`, {
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

  async function toggleCheckoutEnabled() {
    setBillingBusy(true);
    setBillingError(null);
    const next = !checkoutEnabled;
    const res = await fetch(`/api/admin/parent-orgs/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutEnabled: next }),
    });
    const data = await res.json().catch(() => null);
    setBillingBusy(false);
    if (!res.ok) {
      setBillingError(data?.message ?? "Failed to update checkout access");
      return;
    }
    setCheckoutEnabled(next);
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

  async function syncBranches() {
    setBillingBusy(true);
    setBillingError(null);
    setSyncResult(null);
    const res = await fetch(`/api/admin/parent-orgs/${params.id}/billing/sync-branches`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBillingBusy(false);
    if (!res.ok) {
      setBillingError(data?.message ?? "Failed to sync branches");
      return;
    }
    setSyncResult(
      `${data.synced} branch(es) synced` + (data.failed?.length ? `, ${data.failed.length} failed — see server log` : "")
    );
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

    // Account activation completeness check — see the same block on the
    // Business detail page for why this matters before the welcome email fires.
    if (isNew) {
      const missing: string[] = [];
      if (!form.pricingAmount.trim()) missing.push("Pricing (Address & Billing tab)");
      if (!form.contactPhone.trim()) missing.push("Contact phone (Contact tab)");
      if (missing.length > 0) {
        const proceed = confirm(
          `This organization looks incomplete:\n\n${missing.map((m) => `• ${m}`).join("\n")}\n\nCreate it anyway? The welcome email will still be sent.`
        );
        if (!proceed) return;
      }
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
      pricingTerms: {
        amount: form.pricingAmount.trim() ? Number(form.pricingAmount) : null,
        currency: form.pricingCurrency || "usd",
        interval: form.pricingInterval || null,
      },
      ...(isNew && form.compEnabled
        ? { compPeriod: form.compPeriod, compCustomExpiresAt: form.compCustomExpiresAt || undefined }
        : {}),
      ...(!isNew
        ? {
            commandCenterEnabled: form.commandCenterEnabled,
            ragThresholds: {
              starGreenMin: Number(form.ragThresholds.starGreenMin),
              starAmberMin: Number(form.ragThresholds.starAmberMin),
              npsGreenMin: Number(form.ragThresholds.npsGreenMin),
              npsAmberMin: Number(form.ragThresholds.npsAmberMin),
            },
          }
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
            disabled={isNew && (t.id === "businesses" || t.id === "command-center" || t.id === "performance" || t.id === "escalation")}
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

      {tab === "performance" && !isNew && (
        <div>
          {performanceLoading && <p className="subtitle">Loading…</p>}
          {performanceError && <p className="error-text">{performanceError}</p>}
          {performance && (
            <>
              <div className="grid grid-4" style={{ marginBottom: 20 }}>
                <div className="card">
                  <div className="metric-label">
                    Total responses (network)
                    <InfoTip text={tooltips["total-responses"]} />
                  </div>
                  <div className="metric-val">{performance.totalResponses}</div>
                </div>
                <div className="card">
                  <div className="metric-label">
                    Average score (network)
                    <InfoTip text={tooltips["average-score"]} />
                  </div>
                  <div className="metric-val">{performance.starAverage !== null ? `${performance.starAverage}/5` : "—"}</div>
                </div>
                <div className="card">
                  <div className="metric-label">
                    NPS (network)
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
                  <div className="metric-label">Open action items (network)</div>
                  <div className="metric-val">{performance.actionBoard.openCount}</div>
                </div>
                <div className="card" style={{ background: performance.actionBoard.overdueCount > 0 ? "var(--red-bg)" : undefined }}>
                  <div className="metric-label" style={{ color: performance.actionBoard.overdueCount > 0 ? "var(--red)" : undefined }}>
                    Overdue action items (network)
                    <InfoTip text={tooltips["overdue-actions"]} />
                  </div>
                  <div className="metric-val" style={{ color: performance.actionBoard.overdueCount > 0 ? "var(--red)" : undefined }}>
                    {performance.actionBoard.overdueCount}
                  </div>
                </div>
              </div>

              <PeriodComparisonCards comparisons={performance.comparisons} />

              <div className="grid grid-2" style={{ marginTop: 20, marginBottom: 20 }}>
                <div className="card">
                  <h3>
                    Response trend
                    <InfoTip text={tooltips["response-trend"]} />
                  </h3>
                  <p className="card-sub">Daily average score across the network, last {performance.trend.length} days.</p>
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
                  <p className="card-sub">Last 30 days, across the network.</p>
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

              <h3>
                Per-branch breakdown
                <InfoTip text={tooltips["per-branch"]} />
              </h3>
              <table className="clean striped">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Region</th>
                    <th>Average score</th>
                    <th>NPS</th>
                    <th>Responses</th>
                    <th>7d trend</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {performance.businesses.map((b) => (
                    <tr key={b.businessId}>
                      <td>{b.name}</td>
                      <td>{b.region || "—"}</td>
                      <td>{b.starAverage !== null ? `${b.starAverage}/5` : "—"}</td>
                      <td>{b.npsScore !== null ? formatSigned(b.npsScore) : "—"}</td>
                      <td>{b.responseCount}</td>
                      <td>
                        {b.weekChangePercent === null ? (
                          "—"
                        ) : (
                          <span className={b.weekChangePercent >= 0 ? "metric-note up" : "metric-note down"}>
                            {b.weekChangePercent >= 0 ? "↑" : "↓"} {Math.abs(b.weekChangePercent)}%
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link className="btn btn-sm" href={`/admin/businesses/${b.businessId}?tab=performance`}>
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {performance.businesses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="subtitle">
                        No businesses in this organization yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
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

      {tab === "address" && (
        <div className="card" style={{ maxWidth: 640, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Pricing</h3>
              <p className="card-sub" style={{ margin: "4px 0 0" }}>
                What this org is charged for every &quot;group_pays&quot; branch it covers — set here, never in the
                Stripe Dashboard.
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
            <p className="card-sub" style={{ margin: "0 0 4px" }}>Saved when you create the organization.</p>
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

      {tab === "address" && !isNew && (
        <div className="card" style={{ maxWidth: 640, marginTop: 16 }}>
          <h3>Subscription</h3>
          {billingError && <p className="error-text">{billingError}</p>}
          <div className="row-flex" style={{ marginBottom: 10, alignItems: "center", gap: 10 }}>
            <span className={`pill ${checkoutEnabled ? "pill-green" : "pill-gray"}`}>
              {checkoutEnabled ? "Self-service checkout: open" : "Self-service checkout: closed"}
            </span>
            <button className="btn btn-sm" disabled={billingBusy} onClick={toggleCheckoutEnabled}>
              {checkoutEnabled ? "Turn off" : "Enable checkout"}
            </button>
            {checkoutEnabled && (
              <span className="card-sub" style={{ margin: 0 }}>
                A &quot;Continue to payment&quot; link is now live on this org&apos;s own billing page.
              </span>
            )}
          </div>
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
              {!subscription.isComp && subscription.status === "active" && (
                <button
                  className="btn btn-sm"
                  disabled={billingBusy}
                  onClick={syncBranches}
                  style={{ marginRight: 8 }}
                  title={'Adds a Stripe line item for any branch already set to "group_pays" that this subscription hasn\'t picked up yet'}
                >
                  Sync branch coverage
                </button>
              )}
              {syncResult && <p className="card-sub" style={{ margin: "6px 0 0" }}>{syncResult}</p>}
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
              <p className="card-sub">No subscription yet. This covers every business under this org billed "group_pays."</p>
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

      {tab === "escalation" && !isNew && (
        <div className="card" style={{ maxWidth: 760 }}>
          <h3>Escalation chain</h3>
          <p className="card-sub">
            Who a case goes to if a branch doesn&apos;t resolve it. Level 1 is always the branch&apos;s own owner. Levels
            above that are yours to label however this organisation calls them (Cluster Manager, Regional Head,
            President…) — inherited by every branch under this org.
          </p>
          {escalationMessage && <p className="card-sub">{escalationMessage}</p>}
          <table className="clean" style={{ marginBottom: 12 }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Level</th>
                <th>Label</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Branch owner (fixed)</td>
                <td></td>
              </tr>
              {escalationLevels
                .filter((l) => l.level > 1)
                .map((l) => (
                  <tr key={l.level}>
                    <td>{l.level}</td>
                    <td>
                      <input
                        value={l.label}
                        onChange={(e) =>
                          setEscalationLevels((levels) =>
                            levels.map((x) => (x.level === l.level ? { ...x, label: e.target.value } : x))
                          )
                        }
                        placeholder="e.g. Cluster Manager"
                      />
                    </td>
                    <td>
                      <button className="btn btn-sm" onClick={() => removeEscalationLevel(l.level)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <button className="btn btn-sm" onClick={addEscalationLevel} style={{ marginRight: 8 }}>
            + Add level
          </button>
          <div className="field" style={{ maxWidth: 260, marginTop: 14 }}>
            <label>Auto-escalate after (hours)</label>
            <input
              type="number"
              value={escalationSlaHours}
              onChange={(e) => setEscalationSlaHours(e.target.value)}
              placeholder="Leave blank for manual only"
            />
          </div>
          <button className="btn btn-dark btn-sm" disabled={escalationBusy} onClick={saveEscalationConfig} style={{ marginTop: 10 }}>
            {escalationBusy ? "Saving…" : "Save escalation chain"}
          </button>

          {escalationLevels.filter((l) => l.level > 1).length > 0 && (
            <>
              <h3 style={{ marginTop: 24 }}>Who holds each level</h3>
              <p className="card-sub">
                Scope a person to one region (covers every branch in it) or leave region blank for org-wide.
              </p>
              <table className="clean" style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Region</th>
                    <th>Person</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {escalationAssignments.map((a) => (
                    <tr key={a._id}>
                      <td>{a.level}</td>
                      <td>{a.region || "Org-wide"}</td>
                      <td>{a.userId?.email ?? "(user removed)"}</td>
                      <td>
                        <button className="btn btn-sm" onClick={() => removeEscalationAssignment(a._id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {escalationAssignments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="card-sub">
                        No one assigned yet — cases can&apos;t escalate past level 1 until you add someone.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="field-row" style={{ alignItems: "flex-end" }}>
                <div className="field">
                  <label>Level</label>
                  <select value={assignLevel} onChange={(e) => setAssignLevel(e.target.value)}>
                    <option value="">Choose…</option>
                    {escalationLevels
                      .filter((l) => l.level > 1)
                      .map((l) => (
                        <option key={l.level} value={l.level}>
                          {l.level} — {l.label || "(unlabeled)"}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="field">
                  <label>Region (blank = org-wide)</label>
                  <input value={assignRegion} onChange={(e) => setAssignRegion(e.target.value)} placeholder="e.g. North" />
                </div>
                <div className="field">
                  <label>Person&apos;s email</label>
                  <input value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="name@company.com" />
                </div>
                <button className="btn btn-dark btn-sm" disabled={escalationBusy} onClick={addEscalationAssignment}>
                  Assign
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "command-center" && !isNew && (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="field">
            <div className="field-check">
              <input
                type="checkbox"
                id="command-center-enabled"
                checked={form.commandCenterEnabled}
                onChange={(e) => setForm((f) => ({ ...f, commandCenterEnabled: e.target.checked }))}
              />
              <label htmlFor="command-center-enabled" style={{ margin: 0 }}>
                Show the Command Center to this group&rsquo;s users
              </label>
            </div>
            <div className="field-hint">
              Off hides the Command Center nav item and page entirely for this org&rsquo;s owner and team — everything
              else in the Group portal is unaffected.
            </div>
          </div>

          <div className="section-label">Red / Amber / Green thresholds</div>
          <p className="field-hint" style={{ marginTop: -6, marginBottom: 12 }}>
            Applied to this org&rsquo;s Command Center and every branch underneath it — branches don&rsquo;t set their
            own.
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
          <button className="btn btn-dark" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
