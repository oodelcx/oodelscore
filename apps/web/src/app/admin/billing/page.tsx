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

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

  const [subSearch, setSubSearch] = useState("");
  const [subTypeFilter, setSubTypeFilter] = useState("all");
  const [subStatusFilter, setSubStatusFilter] = useState("all");
  const [invoiceFrom, setInvoiceFrom] = useState("");
  const [invoiceTo, setInvoiceTo] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");

  const [creditOwnerType, setCreditOwnerType] = useState("business");
  const [creditOwnerId, setCreditOwnerId] = useState("");
  const [creditType, setCreditType] = useState("credit");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [issuingCredit, setIssuingCredit] = useState(false);

  function loadInvoices() {
    const params = new URLSearchParams();
    if (invoiceStatusFilter !== "all") params.set("status", invoiceStatusFilter);
    if (invoiceFrom) params.set("from", invoiceFrom);
    if (invoiceTo) params.set("to", invoiceTo);
    return fetchJson<{ invoices: InvoiceRow[] }>(`/api/admin/billing/invoices?${params.toString()}`).then((d) =>
      setInvoices(d.invoices)
    );
  }

  function loadAll() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchJson<{ subscriptions: SubscriptionRow[] }>("/api/admin/billing/subscriptions").then((d) => setSubscriptions(d.subscriptions)),
      loadInvoices(),
      fetchJson<{ issues: IntegrityIssues }>("/api/admin/billing/integrity").then((d) => setIssues(d.issues)),
    ])
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);
  useEffect(() => {
    loadInvoices().catch((err) => setError(err instanceof Error ? err.message : "Failed to load invoices"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceStatusFilter, invoiceFrom, invoiceTo]);

  const mrrTotal = subscriptions.filter((s) => !s.isComp).reduce((sum, s) => sum + s.mrrValue, 0);
  const hasIntegrityIssues = issues && (issues.orphanedSubscriptionIds.length > 0 || issues.groupPaysWithOwnSubscriptionIds.length > 0);

  const overdueSubs = subscriptions.filter((s) => s.status === "overdue");
  const overdueAtRisk = overdueSubs.reduce((sum, s) => sum + s.mrrValue, 0);

  const mrrByPlan = new Map<string, number>();
  for (const s of subscriptions) {
    const key = s.isComp ? "comp" : s.plan;
    mrrByPlan.set(key, (mrrByPlan.get(key) ?? 0) + s.mrrValue);
  }
  const maxPlanMrr = Math.max(1, ...Array.from(mrrByPlan.values()));

  const filteredSubscriptions = subscriptions.filter((s) => {
    if (subTypeFilter !== "all" && s.ownerType !== subTypeFilter) return false;
    if (subStatusFilter !== "all" && s.status !== subStatusFilter) return false;
    if (subSearch.trim() && !s.ownerName.toLowerCase().includes(subSearch.trim().toLowerCase())) return false;
    return true;
  });

  function exportInvoicesCsv() {
    const rows = [
      ["Date", "Account", "Amount", "Currency", "Status"],
      ...invoices.map((i) => [new Date(i.issuedAt).toLocaleDateString(), i.ownerName, i.amount.toFixed(2), i.currency.toUpperCase(), i.status]),
    ];
    downloadCsv("oodelscore-invoice-ledger.csv", rows);
  }

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
        <button className="btn" onClick={exportInvoicesCsv} disabled={invoices.length === 0}>
          ⬇ Export for accounting
        </button>
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

          <div className="grid grid-4" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="metric-label">Total MRR</div>
              <div className="metric-val">${mrrTotal.toFixed(2)}</div>
              <div className="metric-note">Excludes comp accounts</div>
            </div>
            <div className="card">
              <div className="metric-label">Subscriptions</div>
              <div className="metric-val">{subscriptions.length}</div>
              <div className="metric-note">{subscriptions.filter((s) => s.isComp).length} comp</div>
            </div>
            <div className="card" style={{ background: overdueSubs.length > 0 ? "var(--amber-bg)" : undefined }}>
              <div className="metric-label" style={{ color: overdueSubs.length > 0 ? "var(--amber)" : undefined }}>
                Failed / overdue
              </div>
              <div className="metric-val" style={{ color: overdueSubs.length > 0 ? "var(--amber)" : undefined }}>
                {overdueSubs.length} account{overdueSubs.length === 1 ? "" : "s"}
              </div>
              <div className="metric-note" style={{ color: overdueSubs.length > 0 ? "var(--amber)" : undefined }}>
                ${overdueAtRisk.toFixed(2)} at risk
              </div>
            </div>
            <div className="card" style={{ background: hasIntegrityIssues ? "var(--red-bg)" : undefined }}>
              <div className="metric-label" style={{ color: hasIntegrityIssues ? "var(--red)" : undefined }}>
                Data integrity
              </div>
              <div className="metric-val" style={{ color: hasIntegrityIssues ? "var(--red)" : undefined }}>
                {(issues?.orphanedSubscriptionIds.length ?? 0) + (issues?.groupPaysWithOwnSubscriptionIds.length ?? 0)}
              </div>
              <div className="metric-note" style={{ color: hasIntegrityIssues ? "var(--red)" : undefined }}>
                Issue(s) found
              </div>
            </div>
          </div>

          {mrrByPlan.size > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3>MRR by plan</h3>
              <div className="bars">
                {Array.from(mrrByPlan.entries()).map(([plan, value]) => (
                  <div className="bar-row" key={plan} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div className="bar-label" style={{ width: 140, fontSize: 12.5 }}>
                      {plan}
                    </div>
                    <div className="bar-track" style={{ flex: 1, background: "var(--border)", borderRadius: 6, height: 10 }}>
                      <div
                        className="bar-fill"
                        style={{
                          width: `${(value / maxPlanMrr) * 100}%`,
                          background: plan === "comp" ? "#DADAD5" : "var(--accent)",
                          height: 10,
                          borderRadius: 6,
                        }}
                      />
                    </div>
                    <div className="bar-val" style={{ width: 90, textAlign: "right", fontSize: 12.5 }}>
                      ${value.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="section-title" style={{ marginTop: 0 }}>
            Subscriptions
          </div>
          <div className="filters">
            <input type="text" placeholder="Search by account name…" value={subSearch} onChange={(e) => setSubSearch(e.target.value)} />
            <select value={subTypeFilter} onChange={(e) => setSubTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              <option value="business">Business</option>
              <option value="parentOrg">Parent Org</option>
            </select>
            <select value={subStatusFilter} onChange={(e) => setSubStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="overdue">Overdue</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
          <table className="clean" style={{ marginBottom: 30 }}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th>Plan</th>
                <th>MRR</th>
                <th>Status</th>
                <th>Next payment</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscriptions.map((s) => (
                <tr key={s._id}>
                  <td>{s.ownerName}</td>
                  <td>{s.ownerType === "business" ? "Business" : "Parent Org"}</td>
                  <td>
                    {s.plan} {s.isComp && <span className="pill pill-gray">comp</span>}
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
              {filteredSubscriptions.length === 0 && (
                <tr>
                  <td colSpan={6} className="subtitle">
                    {subscriptions.length === 0 ? "No subscriptions yet." : "No subscriptions match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="section-title">Invoice ledger</div>
          <p className="section-sub">Every individual payment across the platform, for reconciliation and accounting exports.</p>
          <div className="filters">
            <input type="date" value={invoiceFrom} onChange={(e) => setInvoiceFrom(e.target.value)} title="From date" />
            <input type="date" value={invoiceTo} onChange={(e) => setInvoiceTo(e.target.value)} title="To date" />
            <select value={invoiceStatusFilter} onChange={(e) => setInvoiceStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <table className="clean" style={{ marginBottom: 30 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i._id}>
                  <td>{new Date(i.issuedAt).toLocaleDateString()}</td>
                  <td>{i.ownerName}</td>
                  <td>
                    {i.amount.toFixed(2)} {i.currency.toUpperCase()}
                  </td>
                  <td>
                    <span className={`pill ${i.status === "paid" ? "pill-green" : i.status === "failed" ? "pill-red" : "pill-gray"}`}>
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={4} className="subtitle">
                    No invoices match this filter.
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
