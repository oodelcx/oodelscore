"use client";

import { useEffect, useState } from "react";

interface BillingData {
  subscription: {
    status: string;
    isComp: boolean;
    plan: string;
    nextPaymentDate: string | null;
    paymentMethodLast4: string;
  } | null;
  invoices: { _id: string; amount: number; currency: string; status: string; issuedAt: string }[];
  groupPaysBranchCount: number;
}

export default function GroupBillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load billing.</p>;

  return (
    <div>
      <h1>Billing</h1>
      <p className="subtitle">Your organization&apos;s subscription, covering every &quot;Group pays&quot; branch.</p>

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
            <button className="btn" disabled={busy} onClick={openPortal}>
              Manage subscription
            </button>
          </div>
        </div>
        <div className="card">
          <h3>Coverage</h3>
          <div className="metric-note">Part of a consolidated invoice covering {data.groupPaysBranchCount} branches billed to your group.</div>
        </div>
      </div>

      <div className="section-title">Invoice history</div>
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
              <td>
                <span className={`pill ${inv.status === "paid" ? "pill-green" : "pill-red"}`}>{inv.status}</span>
              </td>
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
    </div>
  );
}
