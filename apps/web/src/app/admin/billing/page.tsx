"use client";

import { useEffect, useState } from "react";

interface SubscriptionRow {
  _id: string;
  ownerType: string;
  ownerName: string;
  plan: string;
  isComp: boolean;
  mrrValue: number;
  status: string;
  nextPaymentDate: string | null;
}
interface InvoiceRow {
  _id: string;
  ownerName: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string;
}
interface IntegrityIssues {
  orphanedSubscriptionIds: string[];
  groupPaysWithOwnSubscriptionIds: string[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "Request failed");
  return data;
}

export default function BillingOversightPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [issues, setIssues] = useState<IntegrityIssues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creditOwnerType, setCreditOwnerType] = useState("business");
  const [creditOwnerId, setCreditOwnerId] = useState("");
  const [creditType, setCreditType] = useState("credit");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [issuingCredit, setIssuingCredit] = useState(false);

  function loadAll() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchJson<{ subscriptions: SubscriptionRow[] }>("/api/admin/billing/subscriptions").then((d) => setSubscriptions(d.subscriptions)),
      fetchJson<{ invoices: InvoiceRow[] }>("/api/admin/billing/invoices").then((d) => setInvoices(d.invoices)),
      fetchJson<{ issues: IntegrityIssues }>("/api/admin/billing/integrity").then((d) => setIssues(d.issues)),
    ])
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);

  const mrrTotal = subscriptions.filter((s) => !s.isComp).reduce((sum, s) => sum + s.mrrValue, 0);
  const hasIntegrityIssues = issues && (issues.orphanedSubscriptionIds.length > 0 || issues.groupPaysWithOwnSubscriptionIds.length > 0);

  async function issueCredit(e: React.FormEvent) {
    e.preventDefault();
    setIssuingCredit(true);
    setError(null);
    const res = await fetch("/api/admin/billing/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerType: creditOwnerType,
        ownerId: creditOwnerId,
        type: creditType,
        amount: Number(creditAmount),
        reason: creditReason,
      }),
    });
    const data = await res.json().catch(() => null);
    setIssuingCredit(false);
    if (!res.ok) {
      setError(data?.message ?? "Failed to issue credit");
      return;
    }
    setCreditOwnerId("");
    setCreditAmount("");
    setCreditReason("");
    loadAll();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Billing Oversight</h1>
          <p className="subtitle">Full finance view — subscriptions, invoices, and credits across the platform.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="subtitle">Loading…</p>}

      {!loading && (
        <>
          {hasIntegrityIssues && (
            <div className="callout" style={{ background: "var(--red-bg)", borderColor: "#F0C7C7", color: "var(--red)" }}>
              Integrity check found {issues!.orphanedSubscriptionIds.length} orphaned subscription(s) and{" "}
              {issues!.groupPaysWithOwnSubscriptionIds.length} business(es) billed both individually and via their group — see spec
              Section 5 bug #4.
            </div>
          )}

          <div className="grid grid-2" style={{ marginBottom: 24 }}>
            <div className="card">
              <h3>Monthly Recurring Revenue</h3>
              <p style={{ fontSize: 26, fontWeight: 600 }}>${mrrTotal.toFixed(2)}</p>
              <p className="card-sub">Excludes comp accounts</p>
            </div>
            <div className="card">
              <h3>Subscriptions</h3>
              <p style={{ fontSize: 26, fontWeight: 600 }}>{subscriptions.length}</p>
              <p className="card-sub">{subscriptions.filter((s) => s.isComp).length} comp</p>
            </div>
          </div>

          <div className="section-title" style={{ marginTop: 0 }}>
            Subscriptions
          </div>
          <table className="clean" style={{ marginBottom: 30 }}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Plan</th>
                <th>MRR</th>
                <th>Status</th>
                <th>Next payment</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s._id}>
                  <td>{s.ownerName}</td>
                  <td>
                    {s.isComp ? <span className="pill pill-purple">Comp</span> : s.plan}
                  </td>
                  <td>${s.mrrValue.toFixed(2)}</td>
                  <td>
                    <span
                      className={`pill ${s.status === "active" ? "pill-green" : s.status === "overdue" ? "pill-amber" : "pill-gray"}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td>{s.nextPaymentDate ? new Date(s.nextPaymentDate).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={5} className="subtitle">
                    No subscriptions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="section-title">Invoices</div>
          <table className="clean" style={{ marginBottom: 30 }}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Issued</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i._id}>
                  <td>{i.ownerName}</td>
                  <td>
                    {i.amount.toFixed(2)} {i.currency.toUpperCase()}
                  </td>
                  <td>
                    <span className={`pill ${i.status === "paid" ? "pill-green" : i.status === "failed" ? "pill-red" : "pill-gray"}`}>
                      {i.status}
                    </span>
                  </td>
                  <td>{new Date(i.issuedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={4} className="subtitle">
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="section-title">Issue a credit or refund</div>
          <form className="card" style={{ maxWidth: 520 }} onSubmit={issueCredit}>
            <div className="field-row">
              <div className="field">
                <label>Owner type</label>
                <select value={creditOwnerType} onChange={(e) => setCreditOwnerType(e.target.value)}>
                  <option value="business">Business</option>
                  <option value="parentOrg">Parent Org</option>
                </select>
              </div>
              <div className="field">
                <label>Owner ID</label>
                <input type="text" value={creditOwnerId} onChange={(e) => setCreditOwnerId(e.target.value)} placeholder="ObjectId" required />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Type</label>
                <select value={creditType} onChange={(e) => setCreditType(e.target.value)}>
                  <option value="credit">Credit</option>
                  <option value="refund">Refund</option>
                </select>
              </div>
              <div className="field">
                <label>Amount</label>
                <input type="text" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="0.00" required />
              </div>
            </div>
            <div className="field">
              <label>Reason</label>
              <input type="text" value={creditReason} onChange={(e) => setCreditReason(e.target.value)} />
            </div>
            <button className="btn btn-dark" disabled={issuingCredit} type="submit">
              {issuingCredit ? "Issuing…" : "Issue"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
