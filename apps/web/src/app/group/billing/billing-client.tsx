"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InfoTip } from "@/components/info-tip";

interface BranchBillingRow {
  businessId: string;
  name: string;
  billingAssignment: string;
  status: string;
}
interface BillingData {
  subscription: {
    status: string;
    isComp: boolean;
    plan: string;
    mrrValue: number;
    nextPaymentDate: string | null;
    paymentMethodLast4: string;
  } | null;
  invoices: { _id: string; amount: number; currency: string; status: string; issuedAt: string }[];
  credits: { _id: string; type: string; amount: number; reason: string; issuedAt: string }[];
  totalBranches: number;
  groupPaysBranchCount: number;
  branchPaysBranchCount: number;
  overdueSelfBilledCount: number;
  branches: BranchBillingRow[];
  checkoutLinkAvailable: boolean;
  pricingTerms: { amount: number | null; currency: string; interval: "monthly" | "annual_monthly_rate" | "annual_lump_sum" | null };
}

const INTERVAL_LABELS: Record<string, string> = {
  monthly: "/month",
  annual_monthly_rate: "/month, billed annually",
  annual_lump_sum: "/year",
};

function statusPill(status: string) {
  const cls = status === "active" || status === "paid" ? "pill-green" : status === "overdue" ? "pill-red" : "pill-gray";
  const label = status === "unassigned" ? "Unassigned" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`pill ${cls}`}>{label}</span>;
}

export default function GroupBillingClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/group/billing")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function openPortal() {
    setBusy(true);
    const res = await fetch("/api/group/billing/portal", { method: "POST" });
    const responseData = await res.json();
    setBusy(false);
    if (res.ok) window.location.href = responseData.url;
    else alert(responseData.message);
  }

  async function continueToPayment() {
    setBusy(true);
    const res = await fetch("/api/group/billing/checkout", { method: "POST" });
    const responseData = await res.json();
    setBusy(false);
    if (res.ok) window.location.href = responseData.url;
    else alert(responseData.message);
  }

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load billing.</p>;

  const filteredBranches = data.branches.filter((b) => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "group" && b.billingAssignment !== "group_pays") return false;
    if (filter === "branch" && b.billingAssignment !== "branch_pays") return false;
    if (filter === "overdue" && b.status !== "overdue") return false;
    return true;
  });

  return (
    <div>
      <h1>Billing</h1>
      <p className="subtitle">What you&apos;re billed for, how you pay it, and the record of every payment.</p>

      {data.checkoutLinkAvailable && (
        <div className="callout callout-amber" style={{ marginBottom: 20 }}>
          <b>Ready to continue with OodelCX?</b>{" "}
          {data.pricingTerms.amount !== null && data.pricingTerms.interval ? (
            <>
              Your plan is{" "}
              <b>
                {data.pricingTerms.currency.toUpperCase()} {data.pricingTerms.amount.toFixed(2)}
                {INTERVAL_LABELS[data.pricingTerms.interval] ?? ""}
              </b>
              . Click below to enter your card details and start your subscription.
            </>
          ) : (
            "Click below to enter your card details and start your subscription."
          )}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" disabled={busy} onClick={continueToPayment}>
              Continue to payment →
            </button>
          </div>
        </div>
      )}

      <div className="callout callout-amber" style={{ marginBottom: 20 }}>
        <b>Which model each branch is on</b> (Group pays vs. branch pays) is set by your OodelCX account manager, not editable
        here — this keeps commercial arrangements consistent when branches are onboarded or transferred. <b>How you pay for the
        branches on &quot;Group pays&quot;</b> is yours to manage below.
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="metric-label">
            Branches billed to group
            <InfoTip text={tooltips["billing-assignment"]} />
          </div>
          <div className="metric-val">{data.groupPaysBranchCount}</div>
          <div className="metric-note">of {data.totalBranches} total</div>
        </div>
        <div className="card">
          <div className="metric-label">Self-billed branches</div>
          <div className="metric-val">{data.branchPaysBranchCount}</div>
          <div className="metric-note">pay individually, group sees status only</div>
        </div>
        <div className="card">
          <div className="metric-label">Group invoice, this cycle</div>
          <div className="metric-val">
            {data.subscription ? `${data.subscription.mrrValue.toFixed(0)}` : "—"}
          </div>
        </div>
        <div className="card" style={{ background: data.overdueSelfBilledCount > 0 ? "var(--red-bg)" : undefined }}>
          <div className="metric-label" style={{ color: data.overdueSelfBilledCount > 0 ? "var(--red)" : undefined }}>
            Overdue (self-billed)
            <InfoTip text={tooltips["overdue-self-billed"]} />
          </div>
          <div className="metric-val" style={{ color: data.overdueSelfBilledCount > 0 ? "var(--red)" : undefined }}>
            {data.overdueSelfBilledCount} branch{data.overdueSelfBilledCount === 1 ? "" : "es"}
          </div>
          <div className="metric-note">visible to you, not payable by you</div>
        </div>
      </div>

      <div className="section-title">How the group pays</div>
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>{data.subscription?.plan ?? "No plan"}</h3>
            <span className={`pill ${data.subscription?.status === "active" ? "pill-green" : "pill-gray"}`}>
              {data.subscription?.isComp ? "Comp" : (data.subscription?.status ?? "none")}
            </span>
          </div>
          {data.subscription?.paymentMethodLast4 && (
            <div className="metric-note">Card ending {data.subscription.paymentMethodLast4}</div>
          )}
          {data.subscription?.nextPaymentDate && (
            <div className="metric-note">Next payment: {new Date(data.subscription.nextPaymentDate).toLocaleDateString()}</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn" disabled={busy || data.checkoutLinkAvailable} onClick={openPortal}>
              Update payment method
            </button>
            <button className="btn" disabled={busy || data.checkoutLinkAvailable} onClick={openPortal}>
              Manage subscription
            </button>
          </div>
        </div>
        <div className="card">
          <h3>Coverage</h3>
          <div className="metric-note">
            Consolidated invoice covering {data.groupPaysBranchCount} branch{data.groupPaysBranchCount === 1 ? "" : "es"} billed to
            your group this cycle.
          </div>
        </div>
      </div>

      <div className="section-title">Branch billing status</div>
      <p className="section-sub">Search to check any branch. Assignment changes go through your account manager — use Messages.</p>
      <div className="filters">
        <input type="text" placeholder="Search branch…" style={{ width: 220 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="group">Group pays</option>
          <option value="branch">Branch pays</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>
      <table className="clean">
        <thead>
          <tr>
            <th>Branch</th>
            <th>Billed to</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredBranches.map((b) => (
            <tr key={b.businessId}>
              <td>{b.name}</td>
              <td>
                <span className={`pill ${b.billingAssignment === "group_pays" ? "pill-blue" : "pill-gray"}`}>
                  {b.billingAssignment === "group_pays" ? "Group" : b.billingAssignment === "branch_pays" ? "Branch" : "Unassigned"}
                </span>
              </td>
              <td>{statusPill(b.status)}</td>
              <td style={{ textAlign: "right" }}>
                {b.status === "overdue" ? (
                  <Link className="btn btn-sm" href="/group/support">
                    Report this →
                  </Link>
                ) : (
                  <Link className="btn btn-sm" href={`/group/branches/${b.businessId}`}>
                    View branch →
                  </Link>
                )}
              </td>
            </tr>
          ))}
          {filteredBranches.length === 0 && (
            <tr>
              <td colSpan={4} className="subtitle">
                No branches match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "10px 0 0" }}>
        Showing {filteredBranches.length} of {data.branches.length} branches.
      </p>

      <div className="section-title">Invoice history</div>
      <p className="section-sub">Every payment made against the group invoice — this is the payment record.</p>
      <table className="clean">
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.invoices.map((inv) => (
            <tr key={inv._id}>
              <td>{new Date(inv.issuedAt).toLocaleDateString()}</td>
              <td>
                {inv.amount.toFixed(2)} {inv.currency.toUpperCase()}
              </td>
              <td>{statusPill(inv.status)}</td>
            </tr>
          ))}
          {data.invoices.length === 0 && (
            <tr>
              <td colSpan={3} className="subtitle">
                No invoices yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {data.credits.length > 0 && (
        <>
          <div className="section-title">Credits &amp; refunds</div>
          <table className="clean">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.credits.map((c) => (
                <tr key={c._id}>
                  <td>{new Date(c.issuedAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`pill ${c.type === "refund" ? "pill-amber" : "pill-green"}`}>{c.type}</span>
                  </td>
                  <td>{c.amount.toFixed(2)}</td>
                  <td>{c.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
