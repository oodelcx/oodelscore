"use client";

import { useEffect, useState } from "react";
import { InfoTip } from "@/components/info-tip";

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
  usage: { feedbackPointsUsed: number; feedbackPointsAllowed: number; responseCount: number };
  billingAssignment: string;
  groupName: string | null;
  groupBranchCount: number | null;
  checkoutLinkAvailable: boolean;
}

export default function BillingClient({ tooltips }: { tooltips: Record<string, string> }) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/business/billing")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function openPortal() {
    setBusy(true);
    const res = await fetch("/api/business/billing/portal", { method: "POST" });
    const responseData = await res.json();
    setBusy(false);
    if (res.ok) window.location.href = responseData.url;
    else alert(responseData.message);
  }

  async function continueToPayment() {
    setBusy(true);
    const res = await fetch("/api/business/billing/checkout", { method: "POST" });
    const responseData = await res.json();
    setBusy(false);
    if (res.ok) window.location.href = responseData.url;
    else alert(responseData.message);
  }

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load billing.</p>;

  if (data.billingAssignment === "group_pays") {
    return (
      <div>
        <h1>Billing</h1>
        <p className="subtitle">Your subscription is managed by {data.groupName ?? "your parent organization"}.</p>
        <div className="callout">
          This business is billed to your parent group, not to you directly. {data.groupName ?? "Your parent group"}&apos;s
          admin manages the payment method and invoice for all its &quot;Group pays&quot; branches, including this one.
          Contact your regional manager for billing questions.
        </div>
        <div className="card">
          <div className="row-flex" style={{ marginBottom: 6 }}>
            <span className="pill pill-blue">Billed to: {data.groupName ?? "Group"}</span>
            <span className="pill pill-green">Active</span>
          </div>
          <div className="metric-note">
            {data.groupBranchCount
              ? `Part of a consolidated invoice covering ${data.groupBranchCount} branch${data.groupBranchCount === 1 ? "" : "es"}. `
              : ""}
            No payment method or invoice history to manage here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Billing</h1>
      <p className="subtitle">Manage your subscription.</p>

      {data.checkoutLinkAvailable && (
        <div className="callout callout-amber" style={{ marginBottom: 20 }}>
          <b>Ready to continue with OodelCX?</b> Click below to enter your card details and start your subscription.
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" disabled={busy} onClick={continueToPayment}>
              Continue to payment →
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>{data.subscription?.plan ?? "No plan"}</h3>
            <span className={`pill ${data.subscription?.status === "active" ? "pill-green" : "pill-gray"}`}>
              {data.subscription?.isComp ? "Comp" : (data.subscription?.status ?? "none")}
            </span>
          </div>
          {data.subscription?.nextPaymentDate && (
            <div className="metric-note">Next payment: {new Date(data.subscription.nextPaymentDate).toLocaleDateString()}</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn" disabled={busy || data.checkoutLinkAvailable} onClick={openPortal}>
              Manage subscription
            </button>
          </div>
        </div>
        <div className="card">
          <h3>
            Usage this cycle
            <InfoTip text={tooltips["usage"]} />
          </h3>
          <div className="config-row">
            <div className="config-label">Feedback points</div>
            <div>
              {data.usage.feedbackPointsUsed} of {data.usage.feedbackPointsAllowed} used
            </div>
          </div>
          <div className="config-row">
            <div className="config-label">Responses collected</div>
            <div>{data.usage.responseCount}</div>
          </div>
          {data.subscription?.paymentMethodLast4 && (
            <div className="config-row">
              <div className="config-label">Payment method</div>
              <div>Card •••• {data.subscription.paymentMethodLast4}</div>
            </div>
          )}
        </div>
      </div>

      <div className="section-title">Invoice history</div>
      <table className="clean">
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.invoices.map((inv) => (
            <tr key={inv._id}>
              <td>{new Date(inv.issuedAt).toLocaleDateString()}</td>
              <td>
                {inv.amount.toFixed(2)} {inv.currency.toUpperCase()}
              </td>
              <td>
                <span className={`pill ${inv.status === "paid" ? "pill-green" : "pill-red"}`}>{inv.status}</span>
              </td>
              <td style={{ textAlign: "right" }}>
                <a
                  href={`/api/business/billing/invoices/${inv._id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent)", cursor: "pointer" }}
                >
                  Download
                </a>
              </td>
            </tr>
          ))}
          {data.invoices.length === 0 && (
            <tr>
              <td colSpan={4} className="subtitle">
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
