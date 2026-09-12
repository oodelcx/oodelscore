"use client";

import { useEffect, useState } from "react";

interface BusinessInfo {
  name: string;
  industry: string;
  contactEmail: string;
  contactPhone: string;
  plan: string;
  maxFeedbackPoints: number;
  billingAssignment: string;
  active: boolean;
}

export default function BusinessOverviewPage() {
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/me")
      .then((res) => res.json())
      .then((data) => setBusiness(data.business))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!business) return <p className="error-text">Couldn&apos;t load your business.</p>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{business.name}</h1>
          <p className="subtitle">Your business overview — most fields here are set by Oodel Score Admin.</p>
        </div>
      </div>

      <div className="card">
        <h3>Details</h3>
        <p className="card-sub">Industry: {business.industry || "—"}</p>
        <p className="card-sub">Contact email: {business.contactEmail || "—"}</p>
        <p className="card-sub">Contact phone: {business.contactPhone || "—"}</p>
        <p className="card-sub">
          Plan: <span className="pill pill-blue">{business.plan}</span>
        </p>
        <p className="card-sub">Max feedback points: {business.maxFeedbackPoints}</p>
        <p className="card-sub">Billing: {business.billingAssignment}</p>
        <p className="card-sub">
          Status: <span className={`pill ${business.active ? "pill-green" : "pill-gray"}`}>{business.active ? "Active" : "Inactive"}</span>
        </p>
      </div>
    </div>
  );
}
